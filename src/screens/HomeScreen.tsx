import { Ionicons } from '@expo/vector-icons';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { VideoCard } from '../components/VideoCard';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { appStyles, colors } from '../utils/theme';

type Props = {
  onOpenSearch: () => void;
  onOpenVideo: (videoId: string) => void;
};

export function HomeScreen({ onOpenSearch, onOpenVideo }: Props) {
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

        <View style={appStyles.heroCard}>
          <Text style={appStyles.heroTitle}>Featured workspace</Text>
          <Text style={appStyles.heroSubtitle}>
            {permissionGranted === false
              ? 'Allow media access to load your device videos and group them into channels.'
              : 'Pick a folder such as Downloads, and Streamy will store that directory URI plus its video file paths in SQLite.'}
          </Text>
        </View>

        {videos.length ? (
          <>
            <Text style={appStyles.sectionTitle}>Latest videos</Text>
            <View style={appStyles.searchResultsList}>
              {videos.slice(0, 6).map((video) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  layout="list"
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
