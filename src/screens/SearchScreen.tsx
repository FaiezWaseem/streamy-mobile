import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { VideoCard } from '../components/VideoCard';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { useServerLibrary } from '../contexts/ServerLibraryContext';
import { appStyles, colors } from '../utils/theme';

type Props = {
  onOpenVideo: (videoId: string) => void;
};

export function SearchScreen({ onOpenVideo }: Props) {
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const { videos: localVideos } = useLocalLibrary();
  const server = useServerLibrary();
  const videos = useMemo(() => [...localVideos, ...server.videos], [localVideos, server.videos]);
  useFocusEffect(useCallback(() => {
    if (server.connected) void server.refresh().catch(() => undefined);
  }, [server.connected, server.refresh]));
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return videos;
    }

    return videos.filter((video) =>
      [video.title, video.creator, video.channelTitle, video.description, ...(video.tags ?? [])]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(search))
    );
  }, [query, videos]);

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.pageContent}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          style={appStyles.searchInput}
          placeholder="Search local and cloud videos"
          placeholderTextColor={colors.textMuted}
        />
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
        <Text style={appStyles.sectionTitle}>Videos</Text>
        {server.isLoading || server.error ? (
          <View style={[appStyles.formStatus, appStyles.formStatusInfo]}>
            <Text style={appStyles.formStatusText}>{server.error ?? 'Refreshing cloud videos…'}</Text>
          </View>
        ) : null}
        {results.length ? (
          <View
            style={
              layout === 'grid' ? appStyles.searchResultsGrid : appStyles.searchResultsList
            }
          >
            {results.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                layout={layout === 'list' ? 'home' : 'grid'}
                onPress={onOpenVideo}
              />
            ))}
          </View>
        ) : !server.isLoading ? (
          <View style={appStyles.emptyState}>
            <Text style={appStyles.emptyStateTitle}>No matching videos</Text>
            <Text style={appStyles.emptyStateText}>
              Try another keyword, scan a local folder, or connect your server in Profile.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
