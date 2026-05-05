import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { VideoCard } from '../components/VideoCard';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { appStyles, colors } from '../utils/theme';

type Props = {
  onOpenSearch: () => void;
  onOpenVideo: (videoId: string) => void;
};

export function HomeScreen({ onOpenSearch, onOpenVideo }: Props) {
  const [layout, setLayout] = useState<'grid' | 'list'>('list');
  const { videos, pickDirectory, isLoading, permissionGranted } = useLocalLibrary();

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
          <Pressable style={appStyles.softButton}>
            <Text style={appStyles.softButtonText}>Upload</Text>
          </Pressable>
          <Pressable style={appStyles.scanButton} onPress={pickDirectory}>
            <Text style={appStyles.scanButtonText}>
              {isLoading ? 'Loading...' : 'Scan Directory'}
            </Text>
          </Pressable>
        </View>

        {videos.length ? (
          <>
            <Text style={appStyles.sectionTitle}>Latest videos</Text>
            <Text style={appStyles.sectionMeta}>
              Browse your local feed in grid or full-width list layout.
            </Text>
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
