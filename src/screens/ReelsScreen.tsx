import { VideoView, useVideoPlayer } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
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
  const [activeReelId, setActiveReelId] = useState<string | undefined>(videos[0]?.id);
  const viewabilityConfig = useMemo(() => ({ itemVisiblePercentThreshold: 75 }), []);
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const nextVisible = viewableItems[0]?.item;
      if (nextVisible?.id) {
        setActiveReelId(nextVisible.id);
      }
    }
  );

  return (
    <SafeAreaView style={appStyles.screen}>
      {videos.length ? (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          pagingEnabled
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged.current}
          getItemLayout={(_, index) => ({
            length: Dimensions.get('window').height,
            offset: Dimensions.get('window').height * index,
            index,
          })}
          renderItem={({ item }) => (
            <ReelItem
              item={item}
              isActive={activeReelId === item.id}
              onOpenSaved={onOpenSaved}
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
};

function ReelItem({ item, isActive, onOpenSaved }: ReelItemProps) {
  const player = useVideoPlayer(item.video, (videoPlayer) => {
    videoPlayer.loop = true;
  });

  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  const reelHeight = Dimensions.get('window').height;

  return (
    <View style={[appStyles.reelSlide, { height: reelHeight }]}>
      <VideoView
        player={player}
        style={appStyles.reelVideo}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />
      <View style={appStyles.reelOverlay} />
      <View style={appStyles.reelDurationBadge}>
        <Text style={appStyles.reelDurationText}>{item.duration}</Text>
      </View>
      <View style={appStyles.reelActions}>
        <ActionBubble icon="heart-outline" label="Like" />
        <ActionBubble icon="chatbubble-ellipses-outline" label="Comment" />
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
    </View>
  );
}
