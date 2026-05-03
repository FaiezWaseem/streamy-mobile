export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  Search: undefined;
  Saved: undefined;
  Video: { videoId: string };
  ChannelVideos: { channelId: string; title: string };
};

export type TabsParamList = {
  Home: undefined;
  Channels: undefined;
  Upload: undefined;
  Reels: undefined;
  Profile: undefined;
};

export type AuthScreenProps = {
  onPrimaryPress: () => void;
  onSecondaryPress: () => void;
};

export type MainTabsProps = {
  onLogout: () => void;
  onOpenSearch: () => void;
  onOpenSaved: () => void;
  onOpenVideo: (videoId: string) => void;
  onOpenChannel: (channelId: string, title: string) => void;
};

export type VideoItem = {
  id: string;
  title: string;
  creator: string;
  image?: string;
  video: string;
  duration: string;
  views: string;
  description: string;
  subscribers: string;
  published: string;
  channelId?: string;
  channelTitle?: string;
  source: 'mock' | 'library' | 'imported';
};

export type ChannelItem = {
  id: string;
  title: string;
  videos: number;
  image?: string;
};
