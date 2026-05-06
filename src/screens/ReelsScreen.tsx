import { useIsFocused } from '@react-navigation/native';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  LayoutChangeEvent,
  Pressable,
  SafeAreaView,
  Text,
  View,
  type ViewToken,
} from 'react-native';

import { ActionBubble } from '../components/ActionBubble';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { appStyles } from '../utils/theme';
import { type VideoItem } from '../utils/types';

type Props = {
  onOpenSaved: () => void;
};

export function ReelsScreen({ onOpenSaved }: Props) {
  const { videos } = useLocalLibrary();
  const isFocused = useIsFocused();
  const [activeReelId, setActiveReelId] = useState<string | undefined>(videos[0]?.id);
  const [reelViewportHeight, setReelViewportHeight] = useState(0);
  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 75 }), []);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const nextVisible = viewableItems[0]?.item;
      if (nextVisible?.id) {
        setActiveReelId(nextVisible.id);
      }
    }
  );

  useEffect(() => {
    if (!videos.some((video) => video.id === activeReelId)) {
      setActiveReelId(videos[0]?.id);
    }
  }, [activeReelId, videos]);

  function handleLayout(event: LayoutChangeEvent) {
    const nextHeight = Math.round(event.nativeEvent.layout.height);

    setReelViewportHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight
    );
  }

  return (
    <SafeAreaView
      style={[appStyles.screen, appStyles.reelsScreen]}
      onLayout={handleLayout}
    >
      {videos.length ? (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          style={appStyles.reelsList}
          snapToInterval={reelViewportHeight || undefined}
          disableIntervalMomentum
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged.current}
          getItemLayout={
            reelViewportHeight
              ? (_, index) => ({
                  length: reelViewportHeight,
                  offset: reelViewportHeight * index,
                  index,
                })
              : undefined
          }
          renderItem={({ item }) => (
            <ReelItem
              item={item}
              isActive={isFocused && activeReelId === item.id}
              onOpenSaved={onOpenSaved}
              reelHeight={reelViewportHeight}
            />
          )}
        />
      ) : (
        <View style={[appStyles.pageContent, { flex: 1, justifyContent: 'center' }]}>
          <View style={appStyles.emptyState}>
            <Text style={appStyles.emptyStateTitle}>No videos for reels yet</Text>
            <Text style={appStyles.emptyStateText}>
              Scan a directory or import local videos to populate the reels feed.
            </Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

type ReelItemProps = {
  item: VideoItem;
  isActive: boolean;
  onOpenSaved: () => void;
  reelHeight: number;
};

function formatPlaybackTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;

  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
    .toString()
    .padStart(2, '0')}`;
}

function ReelItem({ item, isActive, onOpenSaved, reelHeight }: ReelItemProps) {
  const player = useVideoPlayer(item.video, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.playbackRate = 1;
    videoPlayer.timeUpdateEventInterval = 0.25;
  });
  const timeUpdate = useEvent(player, 'timeUpdate', null);
  const sourceLoad = useEvent(player, 'sourceLoad', null);
  const [isPortraitReel, setIsPortraitReel] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isSpeedBoosted, setIsSpeedBoosted] = useState(false);
  const longPressTriggeredRef = useRef(false);
  const elapsedTimeLabel = formatPlaybackTime(timeUpdate?.currentTime ?? 0);
  const totalTimeLabel = formatPlaybackTime(sourceLoad?.duration ?? 0);

  useEffect(() => {
    if (isActive) {
      if (isPaused) {
        player.pause();
      } else {
        player.play();
      }
    } else {
      player.pause();
      player.playbackRate = 1;
      setIsPaused(false);
      setIsSpeedBoosted(false);
      longPressTriggeredRef.current = false;
    }
  }, [isActive, isPaused, player]);

  useEffect(() => {
    return () => {
      player.pause();
      player.playbackRate = 1;
    };
  }, [player]);

  useEffect(() => {
    let isMounted = true;

    if (!item.image) {
      setIsPortraitReel(true);
      return;
    }

    Image.getSize(
      item.image,
      (width, height) => {
        if (!isMounted) {
          return;
        }

        const aspectRatio = width / height;
        setIsPortraitReel(aspectRatio <= 0.7);
      },
      () => {
        if (isMounted) {
          setIsPortraitReel(true);
        }
      }
    );

    return () => {
      isMounted = false;
    };
  }, [item.image]);

  function handleTogglePlayback() {
    if (!isActive) {
      return;
    }

    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    setIsPaused((current) => {
      const nextPaused = !current;

      if (nextPaused) {
        player.pause();
      } else {
        player.play();
      }

      return nextPaused;
    });
  }

  function handleSpeedBoostStart() {
    if (!isActive) {
      return;
    }

    longPressTriggeredRef.current = true;
    player.playbackRate = 2;
    player.play();
    setIsPaused(false);
    setIsSpeedBoosted(true);
  }

  function handleSpeedBoostEnd() {
    player.playbackRate = 1;
    setIsSpeedBoosted(false);
  }

  return (
    <Pressable
      style={[appStyles.reelSlide, reelHeight ? { height: reelHeight } : null]}
      onPress={handleTogglePlayback}
      onLongPress={handleSpeedBoostStart}
      onPressOut={handleSpeedBoostEnd}
      delayLongPress={220}
    >
      <View style={appStyles.reelTapSurface}>
        <VideoView
          player={player}
          style={appStyles.reelVideo}
          contentFit={isPortraitReel ? 'cover' : 'contain'}
          nativeControls={false}
          allowsFullscreen={false}
        />
      </View>
      <View pointerEvents="none" style={appStyles.reelOverlay} />
      <View style={appStyles.reelDurationBadge}>
        <Text style={appStyles.reelDurationText}>
          {elapsedTimeLabel} / {totalTimeLabel}
        </Text>
      </View>
      {isPaused ? (
        <View style={appStyles.reelPlaybackBadge}>
          <Text style={appStyles.reelPlaybackBadgeText}>Paused</Text>
        </View>
      ) : null}
      {isSpeedBoosted ? (
        <View style={appStyles.reelSpeedBadge}>
          <Text style={appStyles.reelSpeedBadgeText}>2x</Text>
        </View>
      ) : null}
      <View style={appStyles.reelActions}>
        <ActionBubble icon="heart-outline" label="Like" />
        <Pressable onPress={onOpenSaved}>
          <ActionBubble icon="bookmark-outline" label="Save" />
        </Pressable>
      </View>
      <View style={appStyles.reelCaption}>
        <Text style={appStyles.reelCreator}>{item.creator}</Text>
        <Text style={appStyles.reelTitle}>{item.title}</Text>
        <Text style={appStyles.reelMeta}>
          {item.views} · {item.published}
        </Text>
      </View>
    </Pressable>
  );
}
