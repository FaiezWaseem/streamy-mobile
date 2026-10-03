import { useSQLiteContext } from 'expo-sqlite';
import { pendingInterestEvents, markInterestSynced, recordInterestEvent } from '../utils/database';
import { normalizeTags, type InterestWatch } from '../utils/recommendations';
import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { formatDuration } from '../utils/media';
import { getLocalMediaInfo, isLocalMediaUri, readContentUriChunk } from '../utils/localFiles';
import { type ChannelItem, type VideoItem } from '../utils/types';

const SECURE_CONFIG_KEY = 'streamy.server.connection.v1';
const CHUNK_SIZE = 4 * 1024 * 1024;

type ServerConfig = { baseUrl: string; token: string; userId?: number };
type ServerVideo = {
  id: number;
  title: string;
  description: string;
  filename: string;
  category: string;
  thumbnail: string | null;
  preview_gif?: string | null;
  tags?: string[];
  can_edit?: boolean;
  duration: number;
  views: number;
  created_at: string;
};

type ServerLibraryValue = {
  connected: boolean;
  serverUrl: string | null;
  videos: VideoItem[];
  channels: ChannelItem[];
  history: InterestWatch[];
  accountKey: string | null;
  updateTags: (videoId: string, tags: string[]) => Promise<void>;
  recordWatch: (event: InterestWatch, seconds: number) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  connect: (url: string, username: string, password: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  upload: (video: VideoItem, onProgress?: (sent: number, total: number) => void, uploadId?: string) => Promise<string>;
  getVideoById: (id: string) => VideoItem | undefined;
  getChannelVideos: (channelId: string) => VideoItem[];
};

const ServerLibraryContext = createContext<ServerLibraryValue | null>(null);

function normalizeBaseUrl(value: string) {
  const url = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) throw new Error('Enter a full server URL starting with https:// or http://.');
  return url;
}

async function readError(response: Response) {
  try {
    const body = await response.json();
    return body?.error ?? `Server request failed (${response.status}).`;
  } catch {
    return `Server request failed (${response.status}).`;
  }
}

function mapVideo(baseUrl: string, token: string, row: ServerVideo): VideoItem {
  return {
    id: `server-${row.id}`,
    title: row.title,
    creator: row.category,
    channelId: `server-category-${encodeURIComponent(row.category)}`,
    channelTitle: row.category,
    image: row.thumbnail ? new URL(row.thumbnail, `${baseUrl}/`).toString() : undefined,
    previewGif: row.preview_gif ? new URL(row.preview_gif, `${baseUrl}/`).toString() : undefined,
    video: `${baseUrl}/stream.php?id=${row.id}`,
    duration: formatDuration(row.duration),
    views: `${row.views} views`,
    description: row.description || '',
    subscribers: 'Server library',
    published: row.created_at,
    source: 'server',
    tags: row.tags ?? [],
    canEdit: row.can_edit ?? false,
    authToken: token,
  };
}

function durationSeconds(value: string) {
  const parts = value.split(':').map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

async function sendInterestWatch(config: ServerConfig, event: InterestWatch, seconds: number) {
  const response = await fetch(`${config.baseUrl}/mobile_api.php?action=watch`, {
    method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: Number(event.video_id.replace('server-', '')), event_id: event.event_id,
      watched_at: event.watched_at, watched_seconds: seconds, duration: event.duration }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const body = await response.json() as { recorded: boolean };
  if (!body.recorded) throw new Error('The server could not record this watch.');
}

export function ServerLibraryProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [history, setHistory] = useState<InterestWatch[]>([]);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(SECURE_CONFIG_KEY).then((value) => {
      if (!value) return;
      try { setConfig(JSON.parse(value) as ServerConfig); } catch { void SecureStore.deleteItemAsync(SECURE_CONFIG_KEY); }
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!config) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${config.baseUrl}/mobile_api.php?action=videos`, {
        headers: { Authorization: `Bearer ${config.token}` },
      });
      if (!response.ok) throw new Error(await readError(response));
      const body = await response.json() as { videos: ServerVideo[]; history?: InterestWatch[]; user_id?: number };
      setHistory(body.history ?? []);
      if (body.user_id) {
        const accountKey = `${config.baseUrl}#${body.user_id}`;
        const pending = await pendingInterestEvents(db, accountKey);
        await Promise.allSettled(pending.map(async event => {
          if (body.videos.some(video => `server-${video.id}` === event.video_id)) {
            await sendInterestWatch(config, event, event.watched_seconds ?? 0);
          }
          await markInterestSynced(db, event.event_id);
        }));
        if (!config.userId) {
          const next = { ...config, userId: body.user_id };
          await SecureStore.setItemAsync(SECURE_CONFIG_KEY, JSON.stringify(next)); setConfig(next);
        }
      }
      setVideos(body.videos.map((row) => mapVideo(config.baseUrl, config.token, row)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load server videos.');
      throw cause;
    } finally {
      setIsLoading(false);
    }
  }, [config, db]);

  useEffect(() => {
    if (config) void refresh().catch(() => undefined);
  }, [config, refresh]);

  const connect = useCallback(async (url: string, username: string, password: string) => {
    const baseUrl = normalizeBaseUrl(url);
    setError(null);
    const response = await fetch(`${baseUrl}/mobile_api.php?action=login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const body = await response.json() as { token: string; user_id: number };
    const next = { baseUrl, token: body.token, userId: body.user_id };
    await SecureStore.setItemAsync(SECURE_CONFIG_KEY, JSON.stringify(next));
    setVideos([]);
    setHistory([]);
    setConfig(next);
  }, []);

  const disconnect = useCallback(async () => {
    if (config) {
      await fetch(`${config.baseUrl}/mobile_api.php?action=logout`, {
        method: 'POST', headers: { Authorization: `Bearer ${config.token}` },
      }).catch(() => undefined);
    }
    await SecureStore.deleteItemAsync(SECURE_CONFIG_KEY);
    setConfig(null);
    setVideos([]);
    setHistory([]);
    setError(null);
  }, [config]);

  const upload = useCallback(async (video: VideoItem, onProgress?: (sent: number, total: number) => void, existingUploadId?: string) => {
    if (!config) throw new Error('Connect to a Streamy server first.');
    if (!isLocalMediaUri(video.video)) throw new Error('Only device video files can be synced. Direct video links cannot be uploaded.');

    const { size: total, name: filename } = await getLocalMediaInfo(video.video);
    if (!total) throw new Error('The selected video file is empty or unavailable.');
    onProgress?.(0, total);
    const totalChunks = Math.ceil(total / CHUNK_SIZE);
    const uploadId = existingUploadId ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
    const handle = video.video.startsWith('content://') ? null : new File(video.video).open();
    let uploadedId: number | undefined;
    const chunkFile = new File(Paths.cache, `streamy-upload-${uploadId}.bin`);
    try {
      chunkFile.create({ overwrite: true });
      for (let index = 0; index < totalChunks; index += 1) {
        const start = index * CHUNK_SIZE;
        const end = Math.min(total, start + CHUNK_SIZE);
        let bytes: Uint8Array;
        if (handle) {
          handle.offset = start;
          bytes = handle.readBytes(end - start);
        } else {
          bytes = await readContentUriChunk(video.video, start, end - start);
        }
        if (bytes.length !== end - start) throw new Error('Could not read a complete upload chunk. The local file was kept.');
        chunkFile.write(bytes);
        const form = new FormData();
        form.append('chunk', { uri: chunkFile.uri, name: filename, type: 'application/octet-stream' } as unknown as Blob);
        form.append('upload_id', uploadId);
        form.append('filename', filename);
        form.append('chunk_index', String(index));
        form.append('total_chunks', String(totalChunks));
        form.append('total_bytes', String(total));
        form.append('offset', String(start));
        form.append('title', video.title);
        form.append('description', video.description);
        form.append('tags', JSON.stringify(video.tags ?? []));
        form.append('category', video.channelTitle ?? video.creator);
        form.append('duration', String(durationSeconds(video.duration)));

        const response = await fetch(`${config.baseUrl}/mobile_upload.php`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${config.token}` },
          body: form,
        });
        if (!response.ok) throw new Error(await readError(response));
        const result = await response.json() as { success?: boolean; complete?: boolean; bytes?: number; id?: number; error?: string };
        if (result.error) throw new Error(result.error);
        if (!result.success || (index + 1 === totalChunks && (!result.complete || result.bytes !== total))) {
          throw new Error('Server could not verify the complete upload. The local file was kept.');
        }
        if (result.complete) {
          if (result.bytes !== total || !result.id) throw new Error("Server upload verification failed.");
          uploadedId = result.id;
          onProgress?.(total, total);
          break;
        }
        onProgress?.(end, total);
      }
    } finally {
      handle?.close();
      if (chunkFile.exists) chunkFile.delete();
    }
    await refresh().catch(() => undefined);
    if (!uploadedId) throw new Error('Could not confirm the server video ID. The local file was kept.');
    return `server-${uploadedId}`;
  }, [config, refresh]);

  const updateTags = useCallback(async (videoId: string, tags: string[]) => {
    if (!config) throw new Error('Connect your server first.');
    const response = await fetch(`${config.baseUrl}/mobile_api.php?action=tags`, {
      method: 'POST', headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: Number(videoId.replace('server-', '')), tags: normalizeTags(tags) }),
    });
    if (!response.ok) throw new Error(await readError(response));
    const body = await response.json() as { tags: string[] };
    setVideos(current => current.map(video => video.id === videoId ? { ...video, tags: body.tags } : video));
  }, [config]);
  const accountKey = config?.userId ? `${config.baseUrl}#${config.userId}` : null;
  const recordWatch = useCallback(async (event: InterestWatch, seconds: number) => {
    if (!config || !accountKey) return;
    await recordInterestEvent(db, event, seconds, accountKey);
    setHistory(current => [event, ...current.filter(item => item.event_id !== event.event_id)].slice(0, 200));
    try {
      await sendInterestWatch(config, event, seconds);
      await markInterestSynced(db, event.event_id);
    } catch { /* Retry queued watches on the next library refresh. */ }
  }, [config, accountKey, db]);

  const getVideoById = useCallback((id: string) => videos.find((video) => video.id === id), [videos]);
  const getChannelVideos = useCallback((id: string) => videos.filter((video) => video.channelId === id), [videos]);
  const channels = useMemo(() => {
    const grouped = new Map<string, ChannelItem>();
    for (const video of videos) {
      if (!video.channelId) continue;
      const channel = grouped.get(video.channelId);
      if (channel) {
        channel.videos += 1;
        channel.image ??= video.image;
      } else {
        grouped.set(video.channelId, { id: video.channelId, title: video.channelTitle ?? video.creator, videos: 1, image: video.image });
      }
    }
    return Array.from(grouped.values());
  }, [videos]);
  const value = useMemo(() => ({
    connected: Boolean(config), serverUrl: config?.baseUrl ?? null, videos, channels, history, accountKey, isLoading, error,
    connect, disconnect, refresh, upload, getVideoById, getChannelVideos, updateTags, recordWatch,
  }), [config, videos, channels, history, accountKey, isLoading, error, connect, disconnect, refresh, upload, getVideoById, getChannelVideos, updateTags, recordWatch]);

  return <ServerLibraryContext.Provider value={value}>{children}</ServerLibraryContext.Provider>;
}

export function useServerLibrary() {
  const value = useContext(ServerLibraryContext);
  if (!value) throw new Error('useServerLibrary must be used within ServerLibraryProvider');
  return value;
}
