import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { VideoCard } from '../components/VideoCard';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { useServerLibrary } from '../contexts/ServerLibraryContext';
import { getInterestHistory, getRecentVideos, type RecentVideoRow } from '../utils/database';
import { rankVideos, type InterestWatch } from '../utils/recommendations';
import { appStyles, colors } from '../utils/theme';

type Props = {
  onOpenSync: () => void;
  onOpenDirectoryScan: () => void;
  onOpenSearch: () => void;
  onOpenVideo: (videoId: string) => void;
};

export function HomeScreen({ onOpenSync, onOpenDirectoryScan, onOpenSearch, onOpenVideo }: Props) {
  const db = useSQLiteContext();
  const [layout, setLayout] = useState<'grid' | 'list'>('list');
  const [recentVideos, setRecentVideos] = useState<RecentVideoRow[]>([]);
  const [interestHistory, setInterestHistory] = useState<InterestWatch[]>([]);
  const { videos: localVideos, getVideoById: getLocalVideoById, pickDirectory, importPickedDirectory, isLoading } =
    useLocalLibrary();
  const server = useServerLibrary();
  const videos = useMemo(() => [...localVideos, ...server.videos], [localVideos, server.videos]);
  const recommendations = useMemo(() => rankVideos(videos, [...server.history, ...interestHistory]).slice(0, 12), [videos, server.history, interestHistory]);
  const getVideoById = (id: string) => getLocalVideoById(id) ?? server.getVideoById(id);

  useFocusEffect(
    useCallback(() => {
      async function loadRecentVideos() {
        const rows = await getRecentVideos(db, 3);
        setRecentVideos(rows);
        setInterestHistory(await getInterestHistory(db, server.accountKey));
      }

      loadRecentVideos();
    }, [db, server.accountKey])
  );

  useFocusEffect(
    useCallback(() => {
      if (server.connected) void server.refresh().catch(() => undefined);
    }, [server.connected, server.refresh])
  );

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
          <Pressable style={appStyles.iconButton} onPress={onOpenSync} accessibilityLabel="Sync videos">
            <Ionicons name="cloud-upload-outline" size={24} color={colors.text} />
          </Pressable>
          {/* <Pressable style={appStyles.softButton}>
            <Text style={appStyles.softButtonText}>Upload</Text>
          </Pressable> */}
          <Pressable style={appStyles.iconButton} onPress={onOpenDirectoryScan} accessibilityLabel="Scan directory">
            <Ionicons name="folder-open-outline" size={24} color={colors.text} />
          </Pressable>
        </View>

        {server.error ? (
          <View style={[appStyles.formStatus, appStyles.formStatusError]}>
            <Text style={appStyles.formStatusText}>{server.error}</Text>
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

            <Text style={appStyles.sectionTitle}>Recommended for you</Text>
            <View style={layout === 'grid' ? appStyles.searchResultsGrid : appStyles.searchResultsList}>
              {recommendations.map(video => <VideoCard key={video.id} video={video} layout={layout === 'list' ? 'home' : 'grid'} onPress={onOpenVideo} />)}
            </View>

            <Text style={appStyles.sectionTitle}>Your videos</Text>
            <View
              style={
                layout === 'grid' ? appStyles.searchResultsGrid : appStyles.searchResultsList
              }
            >
              {videos.map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  layout={layout === 'list' ? 'home' : 'grid'}
                  onPress={onOpenVideo}
                />
              ))}
            </View>
          </>
        ) : isLoading || server.isLoading ? (
          <View style={appStyles.emptyState}><Text style={appStyles.emptyStateTitle}>Loading your library…</Text></View>
        ) : (
          <View style={appStyles.emptyState}>
            <Text style={appStyles.emptyStateTitle}>No videos loaded yet</Text>
            <Text style={appStyles.emptyStateText}>Scan a device folder, import videos, or connect your server in Profile. Local and cloud videos appear together here.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
