import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { StatCard } from '../components/StatCard';
import { VideoCard } from '../components/VideoCard';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { getRecentVideos, type RecentVideoRow } from '../utils/database';
import { appStyles, colors } from '../utils/theme';

type Props = {
  onOpenSaved: () => void;
  onOpenVideo: (videoId: string) => void;
  onLogout: () => void;
};

export function ProfileScreen({ onOpenSaved, onOpenVideo, onLogout }: Props) {
  const db = useSQLiteContext();
  const { videos, getVideoById } = useLocalLibrary();
  const [recentVideos, setRecentVideos] = useState<RecentVideoRow[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      async function loadProfileData() {
        const rows = await getRecentVideos(db, 8);
        setRecentVideos(rows);

        const savedRow = await db.getFirstAsync<{ count: number }>(
          'SELECT COUNT(*) as count FROM saved_videos'
        );
        setSavedCount(savedRow?.count ?? 0);

        const viewsRow = await db.getFirstAsync<{ total: number }>(
          'SELECT COALESCE(SUM(view_count), 0) as total FROM recent_videos'
        );
        setViewsCount(viewsRow?.total ?? 0);
      }

      loadProfileData();
    }, [db])
  );

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.pageContent}>
        <View style={appStyles.profileHeader}>
          <View style={appStyles.avatar}>
            <Text style={appStyles.avatarText}>S</Text>
          </View>
          <Text style={appStyles.profileName}>Streamy Creator</Text>
          <Text style={appStyles.profileHandle}>@streamy</Text>
        </View>

        <View style={appStyles.statsRow}>
          <StatCard value={String(videos.length)} label="Videos" />
          <StatCard value={String(viewsCount)} label="Views" />
          <StatCard value={String(savedCount)} label="Saved" />
        </View>

        <Pressable style={appStyles.cardRow} onPress={onOpenSaved}>
          <Ionicons name="bookmark-outline" size={22} color={colors.accent} />
          <Text style={appStyles.cardRowText}>Open Saved</Text>
        </Pressable>

        <Pressable style={appStyles.cardRow} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={22} color={colors.accent} />
          <Text style={appStyles.cardRowText}>Logout</Text>
        </Pressable>

        <Text style={appStyles.sectionTitle}>Recently watched</Text>
        {recentVideos.length ? (
          <View style={appStyles.searchResultsList}>
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
                    description: matchedVideo?.description ?? 'Recently watched local video.',
                    subscribers: matchedVideo?.subscribers ?? 'Watch history',
                    published: matchedVideo?.published ?? 'Recently viewed',
                    channelId: matchedVideo?.channelId,
                    channelTitle: matchedVideo?.channelTitle,
                    source: matchedVideo?.source ?? 'imported',
                  }}
                  layout="home"
                  onPress={onOpenVideo}
                />
              );
            })}
          </View>
        ) : (
          <View style={appStyles.emptyState}>
            <Text style={appStyles.emptyStateTitle}>No watch history yet</Text>
            <Text style={appStyles.emptyStateText}>
              Open a video and it will appear here so the profile page can track your last watched clips.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
