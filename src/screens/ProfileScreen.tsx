import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';

import { StatCard } from '../components/StatCard';
import { VideoCard } from '../components/VideoCard';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { useServerLibrary } from '../contexts/ServerLibraryContext';
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
  const server = useServerLibrary();
  const [serverUrlInput, setServerUrlInput] = useState('');
  const [serverUsername, setServerUsername] = useState('');
  const [serverPassword, setServerPassword] = useState('');
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
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

        <View style={appStyles.uploadPanel}>
          <Text style={appStyles.sectionTitle}>Server library</Text>
          <Text style={appStyles.sectionMeta}>Connect to your Streamy website to browse and stream videos stored there.</Text>
          {server.connected ? (
            <>
              <Text style={appStyles.formStatusText}>Connected to {server.serverUrl}</Text>
              <Pressable style={appStyles.secondaryButton} onPress={() => void server.refresh().then(() => setServerMessage('Server library refreshed.')).catch((error) => setServerMessage(error instanceof Error ? error.message : 'Could not refresh.'))}>
                <Text style={appStyles.secondaryButtonText}>{server.isLoading ? 'Refreshing…' : 'Refresh server library'}</Text>
              </Pressable>
              <Pressable style={appStyles.secondaryButton} onPress={() => void server.disconnect().then(() => setServerMessage('Disconnected from server.'))}>
                <Text style={appStyles.secondaryButtonText}>Disconnect server</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput value={serverUrlInput} onChangeText={setServerUrlInput} placeholder="https://your-streamy-site.com" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="url" style={appStyles.input} />
              <TextInput value={serverUsername} onChangeText={setServerUsername} placeholder="Streamy username" placeholderTextColor={colors.textMuted} autoCapitalize="none" autoCorrect={false} style={appStyles.input} />
              <TextInput value={serverPassword} onChangeText={setServerPassword} placeholder="Password" placeholderTextColor={colors.textMuted} secureTextEntry style={appStyles.input} />
              <Pressable
                style={appStyles.primaryButton}
                disabled={isConnecting || !serverUrlInput.trim() || !serverUsername.trim() || !serverPassword}
                onPress={async () => {
                  setIsConnecting(true);
                  setServerMessage(null);
                  try {
                    await server.connect(serverUrlInput, serverUsername, serverPassword);
                    setServerPassword('');
                    setServerMessage('Connected. Your server library is ready.');
                  } catch (error) {
                    setServerMessage(error instanceof Error ? error.message : 'Could not connect to the server.');
                  } finally {
                    setIsConnecting(false);
                  }
                }}
              >
                <Text style={appStyles.primaryButtonText}>{isConnecting ? 'Connecting…' : 'Connect server'}</Text>
              </Pressable>
            </>
          )}
          {server.error || serverMessage ? (
            <View style={[appStyles.formStatus, server.error ? appStyles.formStatusError : appStyles.formStatusInfo]}>
              <Text style={appStyles.formStatusText}>{server.error ?? serverMessage}</Text>
            </View>
          ) : null}
          {server.connected ? <Text style={appStyles.sectionMeta}>{server.videos.length} server videos available.</Text> : null}
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
