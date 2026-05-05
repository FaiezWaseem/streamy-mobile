import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
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
import { appStyles, colors } from '../utils/theme';

type Props = {
  onOpenVideo: (videoId: string) => void;
};

export function SearchScreen({ onOpenVideo }: Props) {
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const { videos } = useLocalLibrary();
  const [query, setQuery] = useState('');
  const results = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return videos;
    }

    return videos.filter((video) =>
      [video.title, video.creator, video.channelTitle]
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
          placeholder="Search clips, channels, templates"
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
        ) : (
          <View style={appStyles.emptyState}>
            <Text style={appStyles.emptyStateTitle}>No matching videos</Text>
            <Text style={appStyles.emptyStateText}>
              Scan a directory or import a local file to start building your search library.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
