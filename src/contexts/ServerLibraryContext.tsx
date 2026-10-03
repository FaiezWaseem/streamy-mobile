import * as SecureStore from 'expo-secure-store';
import { File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { formatDuration } from '../utils/media';
import { getLocalMediaInfo, isLocalMediaUri, readContentUriChunk } from '../utils/localFiles';
import { type VideoItem } from '../utils/types';

const SECURE_CONFIG_KEY = 'streamy.server.connection.v1';
const CHUNK_SIZE = 4 * 1024 * 1024;

type ServerConfig = { baseUrl: string; token: string };
type ServerVideo = {
  id: number;
  title: string;
  description: string;
  filename: string;
  category: string;
  thumbnail: string | null;
  duration: number;
  views: number;
  created_at: string;
};

type ServerLibraryValue = {
  connected: boolean;
  serverUrl: string | null;
  videos: VideoItem[];
  isLoading: boolean;
  error: string | null;
  connect: (url: string, username: string, password: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
  upload: (video: VideoItem, onProgress?: (sent: number, total: number) => void) => Promise<string>;
  getVideoById: (id: string) => VideoItem | undefined;
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
    channelId: `server-category-${row.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    channelTitle: row.category,
    image: row.thumbnail ? new URL(row.thumbnail, `${baseUrl}/`).toString() : undefined,
    video: `${baseUrl}/stream.php?id=${row.id}`,
    duration: formatDuration(row.duration),
    views: `${row.views} views`,
    description: row.description || '',
    subscribers: 'Server library',
    published: row.created_at,
    source: 'server',
    authToken: token,
  };
}

function durationSeconds(value: string) {
  const parts = value.split(':').map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function ServerLibraryProvider({ children }: { children: ReactNode }) {
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
      const body = await response.json() as { videos: ServerVideo[] };
      setVideos(body.videos.map((row) => mapVideo(config.baseUrl, config.token, row)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load server videos.');
      throw cause;
    } finally {
      setIsLoading(false);
    }
  }, [config]);

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
    const body = await response.json() as { token: string };
    const next = { baseUrl, token: body.token };
    await SecureStore.setItemAsync(SECURE_CONFIG_KEY, JSON.stringify(next));
    setVideos([]);
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
    setError(null);
  }, [config]);

  const upload = useCallback(async (video: VideoItem, onProgress?: (sent: number, total: number) => void) => {
    if (!config) throw new Error('Connect to a Streamy server first.');
    if (!isLocalMediaUri(video.video)) throw new Error('Only device video files can be synced. Direct video links cannot be uploaded.');

    const { size: total, name: filename } = await getLocalMediaInfo(video.video);
    if (!total) throw new Error('The selected video file is empty or unavailable.');
    const totalChunks = Math.ceil(total / CHUNK_SIZE);
    const uploadId = `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
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
        onProgress?.(end, total);
        if (index + 1 === totalChunks) uploadedId = result.id;
      }
    } finally {
      handle?.close();
      if (chunkFile.exists) chunkFile.delete();
    }
    await refresh();
    if (!uploadedId) throw new Error('Could not confirm the server video ID. The local file was kept.');
    return `server-${uploadedId}`;
  }, [config, refresh]);

  const getVideoById = useCallback((id: string) => videos.find((video) => video.id === id), [videos]);
  const value = useMemo(() => ({
    connected: Boolean(config), serverUrl: config?.baseUrl ?? null, videos, isLoading, error,
    connect, disconnect, refresh, upload, getVideoById,
  }), [config, videos, isLoading, error, connect, disconnect, refresh, upload, getVideoById]);

  return <ServerLibraryContext.Provider value={value}>{children}</ServerLibraryContext.Provider>;
}

export function useServerLibrary() {
  const value = useContext(ServerLibraryContext);
  if (!value) throw new Error('useServerLibrary must be used within ServerLibraryProvider');
  return value;
}
