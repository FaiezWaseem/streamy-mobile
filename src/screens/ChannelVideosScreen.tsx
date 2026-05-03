import { SafeAreaView, ScrollView, View } from 'react-native';

import { VideoCard } from '../components/VideoCard';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { appStyles } from '../utils/theme';

type Props = {
  channelId: string;
  onOpenVideo: (videoId: string) => void;
};

export function ChannelVideosScreen({ channelId, onOpenVideo }: Props) {
  const { getChannelVideos } = useLocalLibrary();
  const videos = getChannelVideos(channelId);

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.pageContent}>
        <View style={appStyles.searchResultsList}>
          {videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              layout="list"
              onPress={onOpenVideo}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
