import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { appStyles } from '../utils/theme';
import { type VideoItem } from '../utils/types';

type Props = {
  video: VideoItem;
  layout: 'grid' | 'list' | 'home';
  onPress: (videoId: string) => void;
};

const PREVIEW_FRAME_INTERVAL_MS = 220;

export function VideoCard({ video, layout, onPress }: Props) {
  const isGrid = layout === 'grid';
  const isHome = layout === 'home';
  const frames = video.previewFrames;
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const previewIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (previewIntervalRef.current) {
        clearInterval(previewIntervalRef.current);
      }
    };
  }, []);

  function startPreview() {
    if (!frames || frames.length < 2) {
      return;
    }

    setFrameIndex(0);
    setIsPreviewing(true);
    previewIntervalRef.current = setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, PREVIEW_FRAME_INTERVAL_MS);
  }

  function stopPreview() {
    if (previewIntervalRef.current) {
      clearInterval(previewIntervalRef.current);
      previewIntervalRef.current = null;
    }
    setIsPreviewing(false);
  }

  const displayImage = isPreviewing && frames ? frames[frameIndex] : video.image;

  return (
    <Pressable
      onPress={() => onPress(video.id)}
      onLongPress={startPreview}
      onPressOut={stopPreview}
      delayLongPress={220}
      style={
        isGrid
          ? appStyles.videoCardGrid
          : isHome
            ? appStyles.videoCardHome
            : appStyles.videoCardList
      }
    >
      <View
        style={
          isGrid
            ? appStyles.videoCardGridImageWrap
            : isHome
              ? appStyles.videoCardHomeImageWrap
            : appStyles.videoCardListImageWrap
        }
      >
        {displayImage ? (
          <Image
            source={{ uri: displayImage }}
            style={
              isGrid
                ? appStyles.videoCardGridImage
                : isHome
                  ? appStyles.videoCardHomeImage
                : appStyles.videoCardListImage
            }
          />
        ) : (
          <View
            style={
              isGrid
                ? appStyles.videoCardPlaceholderGrid
                : isHome
                  ? appStyles.videoCardPlaceholderHome
                : appStyles.videoCardPlaceholderList
            }
          >
            <Text style={appStyles.videoCardPlaceholderText}>Local Video</Text>
          </View>
        )}
        <View style={appStyles.videoCardDuration}>
          <Text style={appStyles.videoCardDurationText}>{video.duration}</Text>
        </View>
      </View>
      <View
        style={
          isGrid
            ? appStyles.videoCardGridBody
            : isHome
              ? appStyles.videoCardHomeBody
            : appStyles.videoCardListBody
        }
      >
        {isHome ? (
          <>
            <View style={appStyles.videoCardHomeHeader}>
              <View style={appStyles.videoCardHomeAvatar}>
                <Text style={appStyles.videoCardHomeAvatarText}>
                  {(video.channelTitle ?? video.creator).slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={appStyles.videoCardHomeTitleWrap}>
                <Text
                  style={appStyles.videoCardHomeTitle}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {video.title}
                </Text>
                <Text style={appStyles.videoCardMeta}>
                  {video.channelTitle ?? video.creator}
                </Text>
                <Text style={appStyles.videoCardMeta}>
                  {video.views} · {video.published}
                </Text>
              </View>
            </View>
          </>
        ) : isGrid ? (
          <>
            <Text
              style={appStyles.videoCardTitle}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {video.title}
            </Text>
          </>
        ) : (
          <>
            <Text
              style={appStyles.videoCardTitle}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {video.title}
            </Text>
            <Text style={appStyles.videoCardMeta}>{video.creator}</Text>
            <Text style={appStyles.videoCardMeta}>{video.views}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}
