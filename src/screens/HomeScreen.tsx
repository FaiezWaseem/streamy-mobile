import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { VideoCard } from '../components/VideoCard';
import {
  useLocalLibrary,
  type DirectoryImportProgress,
  type DirectorySelection,
} from '../contexts/LocalLibraryContext';
import { getRecentVideos, type RecentVideoRow } from '../utils/database';
import { appStyles, colors } from '../utils/theme';

type Props = {
  onOpenSearch: () => void;
  onOpenVideo: (videoId: string) => void;
};

export function HomeScreen({ onOpenSearch, onOpenVideo }: Props) {
  const db = useSQLiteContext();
  const [layout, setLayout] = useState<'grid' | 'list'>('list');
  const [pendingDirectory, setPendingDirectory] = useState<DirectorySelection | null>(null);
  const [importProgress, setImportProgress] = useState<DirectoryImportProgress | null>(null);
  const [recentVideos, setRecentVideos] = useState<RecentVideoRow[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { videos, getVideoById, pickDirectory, importPickedDirectory, isLoading } =
    useLocalLibrary();

  useFocusEffect(
    useCallback(() => {
      async function loadRecentVideos() {
        const rows = await getRecentVideos(db, 3);
        setRecentVideos(rows);
      }

      loadRecentVideos();
    }, [db])
  );

  async function handlePickDirectory() {
    setStatusMessage(null);
    setImportProgress(null);

    try {
      const selection = await pickDirectory();

      if (!selection) {
        return;
      }

      setPendingDirectory(selection);
    } catch (error) {
      console.log('[home] failed to pick directory', { error });
      setStatusMessage('Could not open the folder picker right now.');
    }
  }

  async function handleConfirmDirectoryImport() {
    if (!pendingDirectory) {
      return;
    }

    setStatusMessage(null);
    setImportProgress({
      imported: 0,
      total: pendingDirectory.totalVideos,
      currentFileName: '',
    });

    try {
      const result = await importPickedDirectory(pendingDirectory, (progress) => {
        setImportProgress(progress);
      });
      setStatusMessage(
        `Imported ${result.imported} videos from "${result.title}" successfully.`
      );
      setPendingDirectory(null);
    } catch (error) {
      console.log('[home] failed to import directory', { error });
      setStatusMessage('Directory import failed before finishing. Please try again.');
    } finally {
      setImportProgress(null);
    }
  }

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={appStyles.pageContent}>
        <View style={appStyles.topBar}>
          <Pressable style={appStyles.iconButton}>
            <Ionicons name="menu" size={24} color={colors.text} />
          </Pressable>
          <Text style={appStyles.pageTitle}>Home</Text>
          <Pressable style={appStyles.iconButton} onPress={onOpenSearch}>
            <Ionicons name="search" size={24} color={colors.text} />
          </Pressable>
          {/* <Pressable style={appStyles.softButton}>
            <Text style={appStyles.softButtonText}>Upload</Text>
          </Pressable> */}
          <Pressable style={appStyles.scanButton} onPress={handlePickDirectory} disabled={isLoading}>
            <Text style={appStyles.scanButtonText}>
              {isLoading ? 'Loading...' : 'Scan Directory'}
            </Text>
          </Pressable>
        </View>

        {pendingDirectory ? (
          <View style={appStyles.directoryReviewCard}>
            <Text style={appStyles.sectionTitle}>Confirm Folder Import</Text>
            <Text style={appStyles.sectionMeta}>
              Review the selected folder before Streamy starts importing video metadata.
            </Text>
            <View style={appStyles.directoryReviewRow}>
              <Text style={appStyles.directoryReviewLabel}>Folder</Text>
              <Text style={appStyles.directoryReviewValue}>{pendingDirectory.title}</Text>
            </View>
            <View style={appStyles.directoryReviewRow}>
              <Text style={appStyles.directoryReviewLabel}>Total Videos</Text>
              <Text style={appStyles.directoryReviewValue}>{pendingDirectory.totalVideos}</Text>
            </View>
            <View style={appStyles.directoryReviewRow}>
              <Text style={appStyles.directoryReviewLabel}>Full Path</Text>
              <Text style={appStyles.directoryReviewPath}>{pendingDirectory.directoryUri}</Text>
            </View>
            <View style={appStyles.directoryReviewActions}>
              <Pressable
                style={appStyles.secondaryButton}
                onPress={() => {
                  setPendingDirectory(null);
                  setImportProgress(null);
                }}
              >
                <Text style={appStyles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={appStyles.primaryButton}
                onPress={handleConfirmDirectoryImport}
                disabled={isLoading}
              >
                <Text style={appStyles.primaryButtonText}>Confirm Import</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {importProgress ? (
          <View style={[appStyles.formStatus, appStyles.formStatusInfo]}>
            <Text style={appStyles.formStatusText}>
              {importProgress.imported}/{importProgress.total} imported
            </Text>
            {importProgress.currentFileName ? (
              <Text style={appStyles.directoryProgressFile}>{importProgress.currentFileName}</Text>
            ) : null}
          </View>
        ) : null}

        {statusMessage ? (
          <View style={[appStyles.formStatus, appStyles.formStatusInfo]}>
            <Text style={appStyles.formStatusText}>{statusMessage}</Text>
          </View>
        ) : null}

        {videos.length ? (
          <>
            <View style={appStyles.toggleRow}>
              <Pressable
                style={[
                  appStyles.toggleButton,
                  layout === 'grid' && appStyles.toggleButtonActive,
                ]}
                onPress={() => setLayout('grid')}
              >
                <Ionicons name="grid-outline" size={18} color={colors.white} />
                <Text style={appStyles.toggleButtonText}>Grid</Text>
              </Pressable>
              <Pressable
                style={[
                  appStyles.toggleButton,
                  layout === 'list' && appStyles.toggleButtonActive,
                ]}
                onPress={() => setLayout('list')}
              >
                <Ionicons name="list-outline" size={18} color={colors.white} />
                <Text style={appStyles.toggleButtonText}>List</Text>
              </Pressable>
            </View>

            <Text style={appStyles.sectionTitle}>Last three watched videos</Text>
            {recentVideos.length ? (
              <View
                style={
                  layout === 'grid' ? appStyles.searchResultsGrid : appStyles.searchResultsList
                }
              >
                {recentVideos.map((item) => {
                  const matchedVideo = getVideoById(item.video_id);

                  return (
                    <VideoCard
                      key={item.video_id}
                      video={{
                        id: item.video_id,
                        title: item.title,
                        creator: item.creator,
                        image: item.thumbnail || matchedVideo?.image,
                        duration: item.duration,
                        views: item.views,
                        video: matchedVideo?.video ?? '',
                        description:
                          matchedVideo?.description ?? 'Recently watched local video.',
                        subscribers: matchedVideo?.subscribers ?? 'Watch history',
                        published: matchedVideo?.published ?? 'Recently viewed',
                        channelId: matchedVideo?.channelId,
                        channelTitle: matchedVideo?.channelTitle,
                        source: matchedVideo?.source ?? 'imported',
                      }}
                      layout={layout === 'list' ? 'home' : 'grid'}
                      onPress={onOpenVideo}
                    />
                  );
                })}
              </View>
            ) : (
              <View style={appStyles.emptyState}>
                <Text style={appStyles.emptyStateTitle}>No watched videos yet</Text>
                <Text style={appStyles.emptyStateText}>
                  Open a few videos and your last three watched clips will show up here.
                </Text>
              </View>
            )}

            <Text style={appStyles.sectionTitle}>Latest videos</Text>
            <View
              style={
                layout === 'grid' ? appStyles.searchResultsGrid : appStyles.searchResultsList
              }
            >
              {videos.slice(0, 6).map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  layout={layout === 'list' ? 'home' : 'grid'}
                  onPress={onOpenVideo}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={appStyles.emptyState}>
            <Text style={appStyles.emptyStateTitle}>No local videos loaded yet</Text>
            <Text style={appStyles.emptyStateText}>
              Tap `Scan Directory` to pick a folder like Downloads, or use Upload to import
              individual video files.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
