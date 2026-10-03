import { Directory, Paths } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { InteractionManager } from 'react-native';

import {
  getLocalVideoTags,
  setVideoTags,
  deleteImportedVideo,
  deleteImportedVideosByChannel,
  deleteScannedDirectory,
  getDirectoryVideos,
  getPendingPreviewVideos,
  getScannedDirectories,
  getImportedVideos,
  pruneDirectoryVideos,
  savePreviewFrames,
  saveScannedDirectory,
  upsertDirectoryVideos,
  type DirectoryVideoRow,
  type ImportedVideoRow,
  type ScannedDirectoryRow,
} from '../utils/database';
import { mapWithConcurrency } from '../utils/concurrency';
import { deleteLocalMediaFile, isLocalMediaUri } from '../utils/localFiles';
import {
  extractDurationInfoFromUri,
  generateBestThumbnail,
  generatePreviewFrames,
} from '../utils/media';
import { normalizeTags } from '../utils/recommendations';
import { type ChannelItem, type VideoItem } from '../utils/types';

const DIRECTORY_SCAN_CONCURRENCY = 4;
const DIRECTORY_SCAN_FLUSH_BATCH_SIZE = 10;
const PREVIEW_QUEUE_BATCH_SIZE = 6;
const PREVIEW_QUEUE_CONCURRENCY = 2;

type DirectoryVideoEntry = {
  name: string;
  uri: string;
};

export type DirectorySelection = {
  directoryUri: string;
  title: string;
  totalVideos: number;
  entries: DirectoryVideoEntry[];
};

export type DirectoryImportProgress = {
  imported: number;
  total: number;
  currentFileName: string;
};

type LocalLibraryContextValue = {
  channels: ChannelItem[];
  videos: VideoItem[];
  permissionGranted: boolean | null;
  isLoading: boolean;
  refreshLibrary: () => Promise<void>;
  rescanScannedDirectories: () => Promise<{ imported: number; total: number }>;
  pickDirectory: () => Promise<DirectorySelection | null>;
  importPickedDirectory: (
    selection: DirectorySelection,
    onProgress?: (progress: DirectoryImportProgress) => void
  ) => Promise<{ imported: number; title: string }>;
  deleteVideo: (videoId: string) => Promise<{ removed: boolean; message: string }>;
  updateTags: (videoId: string, tags: string[]) => Promise<void>;
  removeLocalFileAfterSync: (videoId: string) => Promise<boolean>;
  deleteChannel: (channelId: string) => Promise<{ removed: boolean; message: string }>;
  getChannelVideos: (channelId: string) => VideoItem[];
  getVideoById: (videoId: string) => VideoItem | undefined;
};

const LocalLibraryContext = createContext<LocalLibraryContextValue | null>(null);

function slugifyChannelId(value: string) {
  return `channel-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function directoryChannelId(directoryUri: string) {
  return `directory-${encodeURIComponent(directoryUri)}`;
}

function directoryVideoId(directoryUri: string, fileName: string) {
  return `${directoryUri}:${fileName}`;
}

function isVideoFileName(name: string) {
  return /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(name);
}

function upsertVideosById(existingVideos: VideoItem[], nextVideos: VideoItem[]) {
  const byId = new Map(existingVideos.map((video) => [video.id, video]));

  for (const video of nextVideos) {
    byId.set(video.id, video);
  }

  return Array.from(byId.values());
}

function mapVideosToChannels(videos: VideoItem[]): ChannelItem[] {
  const buckets = new Map<string, ChannelItem>();

  for (const video of videos) {
    const channelId = video.channelId ?? slugifyChannelId(video.creator);
    const title = video.channelTitle ?? video.creator.replace(/^@/, '');
    const existing = buckets.get(channelId);

    if (existing) {
      existing.videos += 1;
      if (!existing.image && video.image) {
        existing.image = video.image;
      }
      continue;
    }

    buckets.set(channelId, {
      id: channelId,
      title,
      videos: 1,
      image: video.image,
    });
  }

  return Array.from(buckets.values()).sort((a, b) => b.videos - a.videos);
}

function mapDirectoryVideoRow(row: DirectoryVideoRow): VideoItem {
  return {
    id: row.video_id,
    title: row.title,
    creator: row.creator,
    channelId: row.channel_id,
    channelTitle: row.channel_title,
    image: row.thumbnail ?? undefined,
    video: row.video_uri,
    duration: row.duration,
    views: row.views,
    description: row.description,
    subscribers: row.subscribers,
    published: row.published,
    source: 'library',
    previewFrames: row.preview_frames ? JSON.parse(row.preview_frames) : undefined,
  };
}

function mapDirectoryVideoToRow(
  video: VideoItem,
  directoryUri: string,
  fileName: string,
  indexedAt: string,
  durationSeconds: number
): DirectoryVideoRow {
  return {
    video_id: video.id,
    directory_uri: directoryUri,
    file_name: fileName,
    title: video.title,
    creator: video.creator,
    channel_id: video.channelId ?? directoryChannelId(directoryUri),
    channel_title: video.channelTitle ?? video.creator,
    video_uri: video.video,
    thumbnail: video.image ?? null,
    duration: video.duration,
    views: video.views,
    description: video.description,
    subscribers: video.subscribers,
    published: video.published,
    indexed_at: indexedAt,
    duration_seconds: durationSeconds,
    preview_frames: null,
    preview_status: 'pending',
  };
}

export function LocalLibraryProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [permissionGranted] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [importedVideos, setImportedVideos] = useState<VideoItem[]>([]);
  const [directoryVideos, setDirectoryVideos] = useState<VideoItem[]>([]);
  const [tagsById, setTagsById] = useState<Record<string, string[]>>({});

  const loadImported = useCallback(async () => {
    const rows = await getImportedVideos(db);
    console.log('[library] loading imported videos from sqlite', { count: rows.length });
    setImportedVideos(
      rows.map((row: ImportedVideoRow) => ({
        id: row.video_id,
        title: row.title,
        creator: row.creator,
        channelId: row.channel_id,
        channelTitle: row.channel_title,
        image: row.thumbnail ?? undefined,
        video: row.video_uri,
        duration: row.duration,
        views: row.views,
        description: row.description,
        subscribers: row.subscribers,
        published: row.published,
        source: 'imported',
      }))
    );
  }, [db]);

  const loadDirectoryVideoCache = useCallback(async () => {
    const rows = await getDirectoryVideos(db);
    console.log('[library] loading cached directory videos from sqlite', {
      count: rows.length,
    });
    setDirectoryVideos(rows.map(mapDirectoryVideoRow));
  }, [db]);

  const getDirectoryEntries = useCallback(async (directoryUri: string) => {
    const directory = new Directory(directoryUri);
    const entries = directory.list();

    return entries
      .filter((entry) => isVideoFileName(entry.name))
      .map((entry) => ({ name: entry.name, uri: entry.uri }));
  }, []);

  const buildDirectoryVideos = useCallback(
    async (
      directoryUri: string,
      title: string,
      entries: DirectoryVideoEntry[],
      onProgress?: (progress: DirectoryImportProgress) => void,
      onVideoReady?: (video: VideoItem) => void
    ) => {
      const indexedAt = new Date().toISOString();
      let completed = 0;
      let pendingRows: DirectoryVideoRow[] = [];
      let writeChain: Promise<void> = Promise.resolve();

      function scheduleFlush(force = false) {
        if (!pendingRows.length || (!force && pendingRows.length < DIRECTORY_SCAN_FLUSH_BATCH_SIZE)) {
          return;
        }

        const rowsToWrite = pendingRows;
        pendingRows = [];
        writeChain = writeChain.then(() => upsertDirectoryVideos(db, rowsToWrite));
      }

      const nextVideos = await mapWithConcurrency(
        entries,
        DIRECTORY_SCAN_CONCURRENCY,
        async (entry) => {
          const durationInfo = await extractDurationInfoFromUri(entry.uri);
          const thumbnailUri = await generateBestThumbnail(entry.uri, durationInfo.seconds);

          console.log('[library] directory video discovered', {
            entryName: entry.name,
            entryUri: entry.uri,
            channelTitle: title,
            thumbnailUri,
            duration: durationInfo.formatted,
          });

          const video: VideoItem = {
            id: directoryVideoId(directoryUri, entry.name),
            title: entry.name.replace(/\.[^/.]+$/, '') || 'Directory video',
            creator: title,
            channelId: directoryChannelId(directoryUri),
            channelTitle: title,
            image: thumbnailUri,
            video: entry.uri,
            duration: durationInfo.formatted,
            views: 'Directory file',
            description: `Loaded from selected directory "${title}".`,
            subscribers: 'Directory source',
            published: 'From picked folder',
            source: 'library',
          };

          pendingRows.push(
            mapDirectoryVideoToRow(video, directoryUri, entry.name, indexedAt, durationInfo.seconds)
          );

          completed += 1;
          onProgress?.({
            imported: completed,
            total: entries.length,
            currentFileName: entry.name,
          });
          onVideoReady?.(video);
          scheduleFlush();

          return video;
        }
      );

      scheduleFlush(true);
      await writeChain;

      return nextVideos;
    },
    [db]
  );

  const previewQueueRunningRef = useRef(false);

  const runPreviewQueueBatch = useCallback(async () => {
    const pending = await getPendingPreviewVideos(db, PREVIEW_QUEUE_BATCH_SIZE);

    if (!pending.length) {
      return false;
    }

    await mapWithConcurrency(pending, PREVIEW_QUEUE_CONCURRENCY, async (row) => {
      try {
        const frames = await generatePreviewFrames(row.video_uri, row.duration_seconds);
        await savePreviewFrames(db, row.video_id, frames.length ? frames : null, frames.length ? 'ready' : 'failed');

        if (frames.length) {
          setDirectoryVideos((current) =>
            current.map((video) =>
              video.id === row.video_id ? { ...video, previewFrames: frames } : video
            )
          );
        }
      } catch (error) {
        console.log('[library] preview frame generation failed', { videoId: row.video_id, error });
        await savePreviewFrames(db, row.video_id, null, 'failed');
      }
    });

    return pending.length === PREVIEW_QUEUE_BATCH_SIZE;
  }, [db]);

  const schedulePreviewQueue = useCallback(() => {
    if (previewQueueRunningRef.current) {
      return;
    }
    previewQueueRunningRef.current = true;

    (async () => {
      try {
        let hasMore = true;

        while (hasMore) {
          await new Promise<void>((resolve) => {
            InteractionManager.runAfterInteractions(() => resolve());
          });
          hasMore = await runPreviewQueueBatch();
        }
      } finally {
        previewQueueRunningRef.current = false;
      }
    })();
  }, [runPreviewQueueBatch]);

  const rescanScannedDirectories = useCallback(async () => {
    setIsLoading(true);

    try {
      const rows = await getScannedDirectories(db);
      const cachedRows = await getDirectoryVideos(db);
      const cachedById = new Map(cachedRows.map((row) => [row.video_id, row]));
      let totalEntries = 0;

      console.log('[library] rescanning scanned directories', {
        count: rows.length,
        rows,
      });

      for (const row of rows as ScannedDirectoryRow[]) {
        try {
          const entries = await getDirectoryEntries(row.directory_uri);
          const missingEntries = entries.filter(
            (entry) => !cachedById.has(directoryVideoId(row.directory_uri, entry.name))
          );
          totalEntries += entries.length;

          console.log('[library] scanning directory for cache changes', {
            title: row.title,
            directoryUri: row.directory_uri,
            entryCount: entries.length,
            missingCount: missingEntries.length,
          });

          if (missingEntries.length) {
            // Persists newly-found videos to SQLite incrementally as it goes.
            await buildDirectoryVideos(row.directory_uri, row.title, missingEntries);
          }

          const keepIds = entries.map((entry) => directoryVideoId(row.directory_uri, entry.name));
          await pruneDirectoryVideos(db, row.directory_uri, keepIds);
        } catch (error) {
          console.log('[library] failed to read scanned directory during rescan', {
            directoryUri: row.directory_uri,
            error,
          });
        }
      }

      const refreshedRows = await getDirectoryVideos(db);
      console.log('[library] directory video cache ready', { count: refreshedRows.length });
      setDirectoryVideos(refreshedRows.map(mapDirectoryVideoRow));
      schedulePreviewQueue();

      return {
        imported: refreshedRows.length,
        total: totalEntries,
      };
    } finally {
      setIsLoading(false);
    }
  }, [buildDirectoryVideos, db, getDirectoryEntries, schedulePreviewQueue]);

  const refreshLibrary = useCallback(async () => {
    setIsLoading(true);

    try {
      console.log('[library] refreshing cached local sources');
      await Promise.all([loadImported(), loadDirectoryVideoCache(), getLocalVideoTags(db).then(setTagsById)]);
    } finally {
      setIsLoading(false);
    }
  }, [db, loadDirectoryVideoCache, loadImported]);

  const pickDirectory = useCallback(async () => {
    console.log('[library] opening directory picker');
    const picked = await Directory.pickDirectoryAsync();
    const title = Paths.basename(picked.uri) || 'Picked directory';
    const entries = await getDirectoryEntries(picked.uri);
    console.log('[library] directory picked', {
      uri: picked.uri,
      title,
      totalVideos: entries.length,
    });

    return {
      directoryUri: picked.uri,
      title,
      totalVideos: entries.length,
      entries,
    };
  }, [getDirectoryEntries]);

  const importPickedDirectory = useCallback(
    async (
      selection: DirectorySelection,
      onProgress?: (progress: DirectoryImportProgress) => void
    ) => {
      setIsLoading(true);

      try {
        console.log('[library] importing picked directory', {
          uri: selection.directoryUri,
          title: selection.title,
          totalVideos: selection.totalVideos,
        });

        await saveScannedDirectory(db, {
          directory_uri: selection.directoryUri,
          title: selection.title,
        });

        // Buffer incremental video completions and flush to UI state on a
        // trailing debounce, so a 300-file scan doesn't trigger 300 re-renders.
        let pendingUiVideos: VideoItem[] = [];
        let flushTimer: ReturnType<typeof setTimeout> | null = null;

        function flushUiVideos() {
          if (!pendingUiVideos.length) {
            return;
          }
          const videosToAdd = pendingUiVideos;
          pendingUiVideos = [];
          setDirectoryVideos((current) => upsertVideosById(current, videosToAdd));
        }

        function scheduleUiFlush() {
          if (flushTimer) {
            return;
          }
          flushTimer = setTimeout(() => {
            flushTimer = null;
            flushUiVideos();
          }, 250);
        }

        const nextVideos = await buildDirectoryVideos(
          selection.directoryUri,
          selection.title,
          selection.entries,
          onProgress,
          (video) => {
            pendingUiVideos.push(video);
            scheduleUiFlush();
          }
        );

        if (flushTimer) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
        flushUiVideos();

        schedulePreviewQueue();

        return {
          imported: nextVideos.length,
          title: selection.title,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [buildDirectoryVideos, db, schedulePreviewQueue]
  );

  const deleteVideo = useCallback(
    async (videoId: string) => {
      const target = importedVideos.find((video) => video.id === videoId);

      if (!target) {
        return {
          removed: false,
          message: 'Only imported videos can be removed individually right now.',
        };
      }

      await deleteImportedVideo(db, videoId);
      console.log('[library] imported video deleted', { videoId, title: target.title });
      await refreshLibrary();

      return {
        removed: true,
        message: 'Imported video removed from Streamy.',
      };
    },
    [db, importedVideos, refreshLibrary]
  );

  const deleteChannel = useCallback(
    async (channelId: string) => {
      if (channelId.startsWith('directory-')) {
        const directoryUri = decodeURIComponent(channelId.replace(/^directory-/, ''));
        await deleteScannedDirectory(db, directoryUri);
        console.log('[library] scanned directory removed', { channelId, directoryUri });
        await refreshLibrary();

        return {
          removed: true,
          message: 'Channel removed from Streamy. Source files on your device were not deleted.',
        };
      }

      await deleteImportedVideosByChannel(db, channelId);
      console.log('[library] imported channel removed', { channelId });
      await refreshLibrary();

      return {
        removed: true,
        message: 'Imported channel and its videos were removed from Streamy.',
      };
    },
    [db, refreshLibrary]
  );

  const removeLocalFileAfterSync = useCallback(async (videoId: string) => {
    const target = [...importedVideos, ...directoryVideos].find((video) => video.id === videoId);
    if (!target || !isLocalMediaUri(target.video)) return false;

    try {
      if (!(await deleteLocalMediaFile(target.video))) return false;
      if (importedVideos.some((video) => video.id === videoId)) {
        await deleteImportedVideo(db, videoId);
      } else {
        await db.runAsync('DELETE FROM directory_videos WHERE video_id = ?', videoId);
      }
      await refreshLibrary();
      return true;
    } catch (error) {
      console.log('[library] uploaded video local cleanup failed', { videoId, error });
      return false;
    }
  }, [db, directoryVideos, importedVideos, refreshLibrary]);

  useEffect(() => {
    refreshLibrary().then(() => schedulePreviewQueue());
  }, [refreshLibrary, schedulePreviewQueue]);

  const videos = useMemo(() => {
    return [...importedVideos, ...directoryVideos].map(video => ({ ...video, tags: tagsById[video.id] ?? [], canEdit: true }));
  }, [directoryVideos, importedVideos, tagsById]);

  const channels = useMemo(() => mapVideosToChannels(videos), [videos]);

  const getChannelVideos = useCallback(
    (channelId: string) => videos.filter((video) => video.channelId === channelId),
    [videos]
  );

  const getVideoById = useCallback(
    (videoId: string) => videos.find((video) => video.id === videoId),
    [videos]
  );

  const updateTags = useCallback(async (videoId: string, tags: string[]) => {
    const normalized = normalizeTags(tags);
    await setVideoTags(db, videoId, normalized);
    setTagsById(current => ({ ...current, [videoId]: normalized }));
  }, [db]);

  const value = useMemo(
    () => ({
      channels,
      videos,
      permissionGranted,
      isLoading,
      refreshLibrary,
      rescanScannedDirectories,
      pickDirectory,
      importPickedDirectory,
      deleteVideo,
      removeLocalFileAfterSync,
      updateTags,
      deleteChannel,
      getChannelVideos,
      getVideoById,
    }),
    [
      channels,
      videos,
      permissionGranted,
      isLoading,
      refreshLibrary,
      rescanScannedDirectories,
      pickDirectory,
      importPickedDirectory,
      deleteVideo,
      removeLocalFileAfterSync,
      updateTags,
      deleteChannel,
      getChannelVideos,
      getVideoById,
    ]
  );

  return (
    <LocalLibraryContext.Provider value={value}>
      {children}
    </LocalLibraryContext.Provider>
  );
}

export function useLocalLibrary() {
  const context = useContext(LocalLibraryContext);

  if (!context) {
    throw new Error('useLocalLibrary must be used within LocalLibraryProvider');
  }

  return context;
}
