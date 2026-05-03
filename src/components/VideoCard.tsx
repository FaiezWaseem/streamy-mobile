import { Image, Pressable, Text, View } from 'react-native';

import { appStyles } from '../utils/theme';
import { type VideoItem } from '../utils/types';

type Props = {
  video: VideoItem;
  layout: 'grid' | 'list';
  onPress: (videoId: string) => void;
};

export function VideoCard({ video, layout, onPress }: Props) {
  return (
    <Pressable
      onPress={() => onPress(video.id)}
      style={layout === 'grid' ? appStyles.videoCardGrid : appStyles.videoCardList}
    >
      <View
        style={
          layout === 'grid'
            ? appStyles.videoCardGridImageWrap
            : appStyles.videoCardListImageWrap
        }
      >
        {video.image ? (
          <Image
            source={{ uri: video.image }}
            style={
              layout === 'grid'
                ? appStyles.videoCardGridImage
                : appStyles.videoCardListImage
            }
          />
        ) : (
          <View
            style={
              layout === 'grid'
                ? appStyles.videoCardPlaceholderGrid
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
          layout === 'grid'
            ? appStyles.videoCardGridBody
            : appStyles.videoCardListBody
        }
      >
        <Text style={appStyles.videoCardTitle}>{video.title}</Text>
        <Text style={appStyles.videoCardMeta}>{video.creator}</Text>
        <Text style={appStyles.videoCardMeta}>{video.views}</Text>
      </View>
    </Pressable>
  );
}
