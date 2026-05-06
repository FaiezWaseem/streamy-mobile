import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { VideoCard } from '../components/VideoCard';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import {
  isVideoLiked,
  isVideoSaved,
  likeVideo,
  recordVideoView,
  saveVideo,
  unlikeVideo,
  unsaveVideo,
} from '../utils/database';
import { appStyles, colors } from '../utils/theme';

type Props = {
  videoId: string;
  onOpenVideo: (videoId: string) => void;
  onOpenChannel: (channelId: string, title: string) => void;
};

function fallbackChannelId(value: string) {
  return `channel-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function VideoScreen({ videoId, onOpenVideo, onOpenChannel }: Props) {
  const db = useSQLiteContext();
  const { videos, getVideoById, deleteVideo } = useLocalLibrary();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const video = useMemo(() => getVideoById(videoId) ?? videos[0], [getVideoById, videoId, videos]);

  if (!video) {
    return (
      <SafeAreaView style={appStyles.screen}>
        <View style={[appStyles.pageContent, { flex: 1, justifyContent: 'center' }]}>
          <View style={appStyles.emptyState}>
            <Text style={appStyles.emptyStateTitle}>No video available</Text>
            <Text style={appStyles.emptyStateText}>
              Scan a directory or import a local video first, then open it here.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const relatedVideos = useMemo(
    () => videos.filter((item) => item.id !== video.id),
    [video.id, videos]
  );
  const player = useVideoPlayer(video.video, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.pause();
  });

  useEffect(() => {
    player.replace(video.video);
    player.pause();
  }, [player, video.video]);

  useEffect(() => {
    async function syncHistory() {
      await recordVideoView(db, video);
    }

    syncHistory();
  }, [db, video]);

  useFocusEffect(
    useCallback(() => {
      async function syncTrackedState() {
        setLiked(await isVideoLiked(db, video.id));
        setSaved(await isVideoSaved(db, video.id));
        setActionMessage(null);
      }

      syncTrackedState();
    }, [db, video.id])
  );

  async function handleToggleLike() {
    console.log('[video] like button tapped', { videoId: video.id, title: video.title });
    const nextLiked = !liked;
    setLiked(nextLiked);

    try {
      if (nextLiked) {
        await likeVideo(db, video);
        const confirmed = await isVideoLiked(db, video.id);
        setLiked(confirmed);
        setActionMessage(confirmed ? 'Added to liked videos.' : 'Could not like this video.');
        console.log('[video] liked video', {
          videoId: video.id,
          title: video.title,
          confirmed,
        });
        return;
      }

      await unlikeVideo(db, video.id);
      const confirmed = await isVideoLiked(db, video.id);
      setLiked(confirmed);
      setActionMessage(!confirmed ? 'Removed from liked videos.' : 'Could not remove like.');
      console.log('[video] unliked video', {
        videoId: video.id,
        title: video.title,
        confirmed,
      });
    } catch (error) {
      console.log('[video] failed to toggle like', {
        videoId: video.id,
        title: video.title,
        error,
      });
      setLiked(!nextLiked);
      setActionMessage('Failed to update liked videos.');
    }
  }

  async function handleToggleSave() {
    console.log('[video] save button tapped', { videoId: video.id, title: video.title });
    const nextSaved = !saved;
    setSaved(nextSaved);

    try {
      if (nextSaved) {
        await saveVideo(db, video);
        const confirmed = await isVideoSaved(db, video.id);
        setSaved(confirmed);
        setActionMessage(confirmed ? 'Saved to your library.' : 'Could not save this video.');
        console.log('[video] saved video', {
          videoId: video.id,
          title: video.title,
          confirmed,
        });
        return;
      }

      await unsaveVideo(db, video.id);
      const confirmed = await isVideoSaved(db, video.id);
      setSaved(confirmed);
      setActionMessage(!confirmed ? 'Removed from your saved videos.' : 'Could not remove save.');
      console.log('[video] unsaved video', {
        videoId: video.id,
        title: video.title,
        confirmed,
      });
    } catch (error) {
      console.log('[video] failed to toggle save', {
        videoId: video.id,
        title: video.title,
        error,
      });
      setSaved(!nextSaved);
      setActionMessage('Failed to update saved videos.');
    }
  }

  function handleOpenChannel() {
    const title = video.channelTitle ?? video.creator;
    const channelId = video.channelId ?? fallbackChannelId(title);
    onOpenChannel(channelId, title);
  }

  function handleDeleteVideo() {
    Alert.alert(
      'Remove video',
      `Remove "${video.title}" from Streamy?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteVideo(video.id);
            setActionMessage(result.message);
          },
        },
      ]
    );
  }

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <VideoView
          player={player}
          style={appStyles.videoHero}
          contentFit="cover"
          nativeControls
          allowsFullscreen
        />

        <View style={appStyles.videoPageBody}>
          <Text style={appStyles.videoPageTitle}>{video.title}</Text>
          <Text style={appStyles.videoPageMeta}>
            {video.views} · {video.published}
          </Text>

          <View style={appStyles.videoActionRow}>
            <Pressable
              style={[
                appStyles.videoActionButton,
                liked && appStyles.videoActionButtonActive,
              ]}
              onPress={handleToggleLike}
            >
              <Ionicons
                name={liked ? 'thumbs-up' : 'thumbs-up-outline'}
                size={18}
                color={colors.white}
              />
              <Text style={appStyles.videoActionText}>{liked ? 'Liked' : 'Like'}</Text>
            </Pressable>
            <Pressable style={appStyles.videoActionButton}>
              <Ionicons name="download-outline" size={18} color={colors.white} />
              <Text style={appStyles.videoActionText}>Download</Text>
            </Pressable>
            <Pressable
              style={[
                appStyles.videoActionButton,
                saved && appStyles.videoActionButtonActive,
              ]}
              onPress={handleToggleSave}
            >
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={colors.white}
              />
              <Text style={appStyles.videoActionText}>{saved ? 'Saved' : 'Save'}</Text>
            </Pressable>
            <Pressable style={appStyles.videoActionButton} onPress={handleDeleteVideo}>
              <Ionicons name="trash-outline" size={18} color={colors.white} />
              <Text style={appStyles.videoActionText}>Remove</Text>
            </Pressable>
          </View>
          {actionMessage ? (
            <View style={[appStyles.formStatus, appStyles.formStatusInfo]}>
              <Text style={appStyles.formStatusText}>{actionMessage}</Text>
            </View>
          ) : null}

          <Pressable style={appStyles.videoChannelCard} onPress={handleOpenChannel}>
            {video.image ? (
              <Image source={{ uri: video.image }} style={appStyles.videoChannelAvatar} />
            ) : (
              <View style={appStyles.videoChannelAvatarPlaceholder}>
                <Text style={appStyles.videoChannelAvatarPlaceholderText}>LV</Text>
              </View>
            )}
            <View style={appStyles.videoChannelMetaWrap}>
              <Text style={appStyles.videoChannelName}>
                {video.channelTitle ?? video.creator}
              </Text>
              <Text style={appStyles.videoChannelSubscribers}>
                {video.subscribers} subscribers
              </Text>
            </View>
            <Pressable style={appStyles.videoSubscribeButton}>
              <Text style={appStyles.videoSubscribeText}>Subscribe</Text>
            </Pressable>
          </Pressable>

          <View style={appStyles.videoDescriptionCard}>
            <Text style={appStyles.videoDescriptionHeading}>Description</Text>
            <Text style={appStyles.videoDescriptionText}>{video.description}</Text>
          </View>

          <Text style={appStyles.sectionTitle}>Up next</Text>
          <View style={appStyles.searchResultsList}>
            {relatedVideos.map((item) => (
              <VideoCard
                key={item.id}
                video={item}
                layout="home"
                onPress={onOpenVideo}
              />
            ))}
          </View>
          {!relatedVideos.length ? (
            <View style={appStyles.emptyState}>
              <Text style={appStyles.emptyStateTitle}>No more videos in this channel yet</Text>
              <Text style={appStyles.emptyStateText}>
                Scan your library or import more local clips to build out this channel.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
