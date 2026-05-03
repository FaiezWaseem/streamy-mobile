import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { VideoCard } from '../components/VideoCard';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { getRecentVideos, recordVideoView, type RecentVideoRow } from '../utils/database';
import { appStyles, colors } from '../utils/theme';

type Props = {
  videoId: string;
  onOpenVideo: (videoId: string) => void;
};

export function VideoScreen({ videoId, onOpenVideo }: Props) {
  const db = useSQLiteContext();
  const { videos, getVideoById } = useLocalLibrary();
  const [recentVideos, setRecentVideos] = useState<RecentVideoRow[]>([]);
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
    videoPlayer.play();
  });

  useEffect(() => {
    player.replace(video.video);
    player.play();
  }, [player, video.video]);

  useEffect(() => {
    async function syncHistory() {
      await recordVideoView(db, video);
      const rows = await getRecentVideos(db, 6);
      setRecentVideos(rows.filter((row) => row.video_id !== video.id));
    }

    syncHistory();
  }, [db, video]);

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
            <Pressable style={appStyles.videoActionButton}>
              <Ionicons name="thumbs-up-outline" size={18} color={colors.white} />
              <Text style={appStyles.videoActionText}>Like</Text>
            </Pressable>
            <Pressable style={appStyles.videoActionButton}>
              <Ionicons name="share-social-outline" size={18} color={colors.white} />
              <Text style={appStyles.videoActionText}>Share</Text>
            </Pressable>
            <Pressable style={appStyles.videoActionButton}>
              <Ionicons name="download-outline" size={18} color={colors.white} />
              <Text style={appStyles.videoActionText}>Download</Text>
            </Pressable>
            <Pressable style={appStyles.videoActionButton}>
              <Ionicons name="bookmark-outline" size={18} color={colors.white} />
              <Text style={appStyles.videoActionText}>Save</Text>
            </Pressable>
          </View>

          <View style={appStyles.videoChannelCard}>
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
          </View>

          <View style={appStyles.videoDescriptionCard}>
            <Text style={appStyles.videoDescriptionHeading}>Description</Text>
            <Text style={appStyles.videoDescriptionText}>{video.description}</Text>
          </View>

          {recentVideos.length ? (
            <>
              <Text style={appStyles.sectionTitle}>Recently watched</Text>
              <View style={appStyles.searchResultsList}>
                {recentVideos.map((item) => (
                  <VideoCard
                    key={item.video_id}
                    video={{
                      id: item.video_id,
                      title: item.title,
                      creator: item.creator,
                      image: item.thumbnail,
                      duration: item.duration,
                      views: item.views,
                      video: getVideoById(item.video_id)?.video ?? video.video,
                      description:
                        getVideoById(item.video_id)?.description ??
                        video.description,
                      subscribers:
                        getVideoById(item.video_id)?.subscribers ??
                        video.subscribers,
                      published:
                        getVideoById(item.video_id)?.published ??
                        video.published,
                      channelId: getVideoById(item.video_id)?.channelId,
                      channelTitle: getVideoById(item.video_id)?.channelTitle,
                      source: getVideoById(item.video_id)?.source ?? video.source,
                    }}
                    layout="list"
                    onPress={onOpenVideo}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Text style={appStyles.sectionTitle}>Up next</Text>
          <View style={appStyles.searchResultsList}>
            {relatedVideos.map((item) => (
              <VideoCard
                key={item.id}
                video={item}
                layout="list"
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
