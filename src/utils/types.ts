export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  Search: { tag?: string } | undefined;
  Saved: undefined;
  Sync: { channelId?: string } | undefined;
  DirectoryScan: undefined;
  TagLibrary: undefined;
  ActorLibrary: undefined;
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
  onOpenSync: (channelId?: string) => void;
  onOpenDirectoryScan: () => void;
  onOpenTags: () => void;
  onOpenActors: () => void;
  onOpenSaved: () => void;
  onOpenVideo: (videoId: string) => void;
  onOpenChannel: (channelId: string, title: string) => void;
};

export type ActorItem = { id: number; name: string; profile_image: string | null };

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
  source: 'mock' | 'library' | 'imported' | 'server';
  authToken?: string;
  previewFrames?: string[];
  previewGif?: string;
  tags?: string[];
  actors?: ActorItem[];
  canEdit?: boolean;
  isDownloaded?: boolean;
};

export type ChannelItem = {
  id: string;
  title: string;
  videos: number;
  image?: string;
};
