import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { VideoCard } from '../components/VideoCard';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { appStyles, colors } from '../utils/theme';

type Props = {
  channelId: string;
  onOpenVideo: (videoId: string) => void;
};

export function ChannelVideosScreen({ channelId, onOpenVideo }: Props) {
  const { getChannelVideos, deleteChannel } = useLocalLibrary();
  const [layout, setLayout] = useState<'grid' | 'list'>('list');
  const [query, setQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const videos = getChannelVideos(channelId);
  const channelTitle = videos[0]?.channelTitle ?? videos[0]?.creator ?? 'This channel';
  const filteredVideos = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return videos;
    }

    return videos.filter((video) =>
      [video.title, video.creator, video.channelTitle, video.description]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(search))
    );
  }, [query, videos]);

  function handleDeleteChannel() {
    Alert.alert(
      'Remove channel',
      `Remove "${channelTitle}" from Streamy?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteChannel(channelId);
            setStatusMessage(result.message);
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.pageContent}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          style={appStyles.searchInput}
          placeholder="Search in this channel"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable style={appStyles.channelDeleteButton} onPress={handleDeleteChannel}>
          <Ionicons name="trash-outline" size={18} color={colors.white} />
          <Text style={appStyles.channelDeleteButtonText}>Remove Channel</Text>
        </Pressable>
        {statusMessage ? (
          <View style={[appStyles.formStatus, appStyles.formStatusInfo]}>
            <Text style={appStyles.formStatusText}>{statusMessage}</Text>
          </View>
        ) : null}
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
        {filteredVideos.length ? (
          <View
            style={
              layout === 'grid' ? appStyles.searchResultsGrid : appStyles.searchResultsList
            }
          >
            {filteredVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                layout={layout === 'list' ? 'home' : 'grid'}
                onPress={onOpenVideo}
              />
            ))}
          </View>
        ) : (
          <View style={appStyles.emptyState}>
            <Text style={appStyles.emptyStateTitle}>No videos found in this channel</Text>
            <Text style={appStyles.emptyStateText}>
              Try a different search term to filter this channel&apos;s videos.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
