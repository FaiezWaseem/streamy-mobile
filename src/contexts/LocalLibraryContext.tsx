import { Directory, Paths } from 'expo-file-system';
import { useSQLiteContext } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  deleteImportedVideo,
  deleteImportedVideosByChannel,
  deleteScannedDirectory,
  getScannedDirectories,
  getImportedVideos,
  saveScannedDirectory,
  type ImportedVideoRow,
  type ScannedDirectoryRow,
} from '../utils/database';
import {
  extractDurationFromUri,
  generateThumbnail,
} from '../utils/media';
import { type ChannelItem, type VideoItem } from '../utils/types';

type LocalLibraryContextValue = {
  channels: ChannelItem[];
  videos: VideoItem[];
  permissionGranted: boolean | null;
  isLoading: boolean;
  refreshLibrary: () => Promise<void>;
  pickDirectory: () => Promise<void>;
  deleteVideo: (videoId: string) => Promise<{ removed: boolean; message: string }>;
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

function isVideoFileName(name: string) {
  return /\.(mp4|mov|m4v|webm|mkv|avi)$/i.test(name);
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

export function LocalLibraryProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const [permissionGranted] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [importedVideos, setImportedVideos] = useState<VideoItem[]>([]);
  const [directoryVideos, setDirectoryVideos] = useState<VideoItem[]>([]);

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

  const loadScannedDirectories = useCallback(async () => {
    const rows = await getScannedDirectories(db);
    console.log('[library] loading scanned directories', { count: rows.length, rows });
    const nextVideos: VideoItem[] = [];

    for (const row of rows as ScannedDirectoryRow[]) {
      try {
        const directory = new Directory(row.directory_uri);
        const entries = directory.list();
        console.log('[library] scanning directory', {
          title: row.title,
          directoryUri: row.directory_uri,
          entryCount: entries.length,
        });

        for (const entry of entries) {
          if (!isVideoFileName(entry.name)) {
            continue;
          }

          const thumbnailUri = await generateThumbnail(entry.uri);
          const duration = await extractDurationFromUri(entry.uri);
          console.log('[library] directory video discovered', {
            entryName: entry.name,
            entryUri: entry.uri,
            channelTitle: row.title,
            thumbnailUri,
            duration,
          });

          nextVideos.push({
            id: `${row.directory_uri}:${entry.name}`,
            title: entry.name.replace(/\.[^/.]+$/, '') || 'Directory video',
            creator: row.title,
            channelId: directoryChannelId(row.directory_uri),
            channelTitle: row.title,
            image: thumbnailUri,
            video: entry.uri,
            duration,
            views: 'Directory file',
            description: `Loaded from selected directory "${row.title}".`,
            subscribers: 'Directory source',
            published: 'From picked folder',
            source: 'library',
          });
        }
      } catch (error) {
        console.log('[library] failed to read scanned directory', {
          directoryUri: row.directory_uri,
          error,
        });
        // Ignore directories that are no longer readable in the current session.
      }
    }

    console.log('[library] scanned directory videos ready', { count: nextVideos.length });
    setDirectoryVideos(nextVideos);
  }, [db]);

  const refreshLibrary = useCallback(async () => {
    setIsLoading(true);

    try {
      console.log('[library] refreshing confirmed local sources');
      await loadImported();
      await loadScannedDirectories();
    } finally {
      setIsLoading(false);
    }
  }, [db, loadImported, loadScannedDirectories]);

  const pickDirectory = useCallback(async () => {
    console.log('[library] opening directory picker');
    const picked = await Directory.pickDirectoryAsync();
    const title = Paths.basename(picked.uri) || 'Picked directory';
    console.log('[library] directory picked', { uri: picked.uri, title });

    await saveScannedDirectory(db, {
      directory_uri: picked.uri,
      title,
    });
    console.log('[library] scanned directory saved in sqlite', { uri: picked.uri, title });

    await loadScannedDirectories();
  }, [db, loadScannedDirectories]);

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

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const videos = useMemo(() => {
    return [...importedVideos, ...directoryVideos];
  }, [directoryVideos, importedVideos]);

  const channels = useMemo(() => mapVideosToChannels(videos), [videos]);

  const getChannelVideos = useCallback(
    (channelId: string) => videos.filter((video) => video.channelId === channelId),
    [videos]
  );

  const getVideoById = useCallback(
    (videoId: string) => videos.find((video) => video.id === videoId),
    [videos]
  );

  const value = useMemo(
    () => ({
      channels,
      videos,
      permissionGranted,
      isLoading,
      refreshLibrary,
      pickDirectory,
      deleteVideo,
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
      pickDirectory,
      deleteVideo,
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
