import * as DocumentPicker from 'expo-document-picker';
import { Directory, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
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
  getScannedDirectories,
  getImportedVideos,
  saveImportedVideo,
  saveScannedDirectory,
  type ImportedVideoRow,
  type ScannedDirectoryRow,
} from '../utils/database';
import { type ChannelItem, type VideoItem } from '../utils/types';

type LocalLibraryContextValue = {
  channels: ChannelItem[];
  videos: VideoItem[];
  permissionGranted: boolean | null;
  isLoading: boolean;
  refreshLibrary: () => Promise<void>;
  pickDirectory: () => Promise<void>;
  importVideo: () => Promise<void>;
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

function formatDuration(seconds: number | undefined) {
  if (!seconds || seconds <= 0) {
    return '0:00';
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [libraryVideos, setLibraryVideos] = useState<VideoItem[]>([]);
  const [importedVideos, setImportedVideos] = useState<VideoItem[]>([]);
  const [directoryVideos, setDirectoryVideos] = useState<VideoItem[]>([]);

  const loadImported = useCallback(async () => {
    const rows = await getImportedVideos(db);
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
    const nextVideos: VideoItem[] = [];

    for (const row of rows as ScannedDirectoryRow[]) {
      try {
        const directory = new Directory(row.directory_uri);
        const entries = directory.list();

        for (const entry of entries) {
          if (!isVideoFileName(entry.name)) {
            continue;
          }

          nextVideos.push({
            id: `${row.directory_uri}:${entry.name}`,
            title: entry.name.replace(/\.[^/.]+$/, '') || 'Directory video',
            creator: row.title,
            channelId: directoryChannelId(row.directory_uri),
            channelTitle: row.title,
            image: undefined,
            video: entry.uri,
            duration: '0:00',
            views: 'Directory file',
            description: `Loaded from selected directory "${row.title}".`,
            subscribers: 'Directory source',
            published: 'From picked folder',
            source: 'library',
          });
        }
      } catch {
        // Ignore directories that are no longer readable in the current session.
      }
    }

    setDirectoryVideos(nextVideos);
  }, [db]);

  const refreshLibrary = useCallback(async () => {
    setIsLoading(true);

    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      setPermissionGranted(permission.granted);

      if (!permission.granted) {
        setLibraryVideos([]);
        await loadImported();
        await loadScannedDirectories();
        return;
      }

      const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
      const seen = new Set<string>();
      const nextVideos: VideoItem[] = [];

      for (const album of albums) {
        const assetsPage = await MediaLibrary.getAssetsAsync({
          album,
          mediaType: ['video'],
          first: 50,
          sortBy: [['creationTime', false]],
        });

        for (const asset of assetsPage.assets) {
          if (seen.has(asset.id)) {
            continue;
          }

          seen.add(asset.id);
          nextVideos.push({
            id: asset.id,
            title: asset.filename.replace(/\.[^/.]+$/, '') || 'Local video',
            creator: album.title,
            channelId: slugifyChannelId(album.title),
            channelTitle: album.title,
            image: undefined,
            video: asset.uri,
            duration: formatDuration(asset.duration),
            views: 'Local file',
            description: `Loaded from your local media library in "${album.title}".`,
            subscribers: 'Local library',
            published: 'On device',
            source: 'library',
          });
        }
      }

      setLibraryVideos(nextVideos);
      await loadImported();
      await loadScannedDirectories();
    } finally {
      setIsLoading(false);
    }
  }, [db, loadImported, loadScannedDirectories]);

  const pickDirectory = useCallback(async () => {
    const picked = await Directory.pickDirectoryAsync();

    await saveScannedDirectory(db, {
      directory_uri: picked.uri,
      title: Paths.basename(picked.uri) || 'Picked directory',
    });

    await loadScannedDirectories();
  }, [db, loadScannedDirectories]);

  const importVideo = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'video/*',
      multiple: false,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];

    await saveImportedVideo(db, {
      video_id: `imported-${Date.now()}`,
      title: asset.name.replace(/\.[^/.]+$/, '') || 'Imported video',
      creator: 'Imported',
      channel_id: 'channel-imported',
      channel_title: 'Imported',
      video_uri: asset.uri,
      thumbnail: null,
      duration: '0:00',
      views: 'Imported file',
      description: 'Imported from the device file picker.',
      subscribers: 'Private import',
      published: 'Just now',
    });

    await loadImported();
  }, [db, loadImported]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  const videos = useMemo(() => {
    return [...importedVideos, ...directoryVideos, ...libraryVideos];
  }, [directoryVideos, importedVideos, libraryVideos]);

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
      importVideo,
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
      importVideo,
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
