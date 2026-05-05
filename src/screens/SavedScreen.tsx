import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { VideoCard } from '../components/VideoCard';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { getSavedVideos, type StoredVideoRow } from '../utils/database';
import { appStyles } from '../utils/theme';

type Props = {
  onOpenVideo: (videoId: string) => void;
};

export function SavedScreen({ onOpenVideo }: Props) {
  const db = useSQLiteContext();
  const { getVideoById } = useLocalLibrary();
  const [savedVideos, setSavedVideos] = useState<StoredVideoRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      async function loadSavedVideos() {
        const rows = await getSavedVideos(db);
        setSavedVideos(rows);
      }

      loadSavedVideos();
    }, [db])
  );

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.pageContent}>
        <Text style={appStyles.pageTitle}>Saved</Text>
        {savedVideos.length ? (
          <View style={appStyles.searchResultsList}>
            {savedVideos.map((item) => {
              const matchedVideo = getVideoById(item.video_id);

              return (
                <VideoCard
                  key={item.video_id}
                  video={{
                    id: item.video_id,
                    title: item.title,
                    creator: item.creator,
                    image: item.thumbnail ?? matchedVideo?.image,
                    video: matchedVideo?.video ?? item.video_uri,
                    duration: item.duration,
                    views: item.views,
                    description: matchedVideo?.description ?? item.description,
                    subscribers: matchedVideo?.subscribers ?? item.subscribers,
                    published: matchedVideo?.published ?? item.published,
                    channelId: matchedVideo?.channelId ?? item.channel_id ?? undefined,
                    channelTitle:
                      matchedVideo?.channelTitle ?? item.channel_title ?? undefined,
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
            <Text style={appStyles.emptyStateTitle}>No saved videos yet</Text>
            <Text style={appStyles.emptyStateText}>
              Tap `Save` on any video page and it will appear here.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
