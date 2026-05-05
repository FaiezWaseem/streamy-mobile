import 'react-native-gesture-handler';

import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { useMemo } from 'react';
import { View } from 'react-native';

import { LocalLibraryProvider } from './src/contexts/LocalLibraryContext';
import { ChannelVideosScreen } from './src/screens/ChannelVideosScreen';
import { ChannelsScreen } from './src/screens/ChannelsScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { ReelsScreen } from './src/screens/ReelsScreen';
import { SavedScreen } from './src/screens/SavedScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { UploadScreen } from './src/screens/UploadScreen';
import { VideoScreen } from './src/screens/VideoScreen';
import { migrateDbIfNeeded } from './src/utils/database';
import { colors, navigationTheme, appStyles } from './src/utils/theme';
import { type MainTabsProps, type RootStackParamList, type TabsParamList } from './src/utils/types';

const Tab = createBottomTabNavigator<TabsParamList>();
const AuthenticatedNav = createNativeStackNavigator<RootStackParamList>();

function App() {
  const stackScreenOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.text,
      headerShadowVisible: false,
      contentStyle: { backgroundColor: colors.background },
    }),
    []
  );

  return (
    <SQLiteProvider databaseName="streamy.db" onInit={migrateDbIfNeeded}>
      <NavigationContainer theme={navigationTheme}>
        <StatusBar style="light" />
        <LocalLibraryProvider>
          <AuthenticatedStack onLogout={() => {}} />
        </LocalLibraryProvider>
      </NavigationContainer>
    </SQLiteProvider>
  );
}

function AuthenticatedStack({ onLogout }: { onLogout: () => void }) {
  return (
    <AuthenticatedNav.Navigator screenOptions={{ headerShown: false }}>
      <AuthenticatedNav.Screen name="MainTabs">
        {({ navigation }) => (
          <MainTabs
            onLogout={onLogout}
            onOpenSearch={() => navigation.navigate('Search')}
            onOpenSaved={() => navigation.navigate('Saved')}
            onOpenVideo={(videoId) => navigation.navigate('Video', { videoId })}
            onOpenChannel={(channelId, title) =>
              navigation.navigate('ChannelVideos', { channelId, title })
            }
          />
        )}
      </AuthenticatedNav.Screen>
      <AuthenticatedNav.Screen name="Search" options={{ headerShown: true, title: 'Search' }}>
        {({ navigation }) => (
          <SearchScreen onOpenVideo={(videoId) => navigation.navigate('Video', { videoId })} />
        )}
      </AuthenticatedNav.Screen>
      <AuthenticatedNav.Screen name="Saved" options={{ headerShown: true, title: 'Saved' }}>
        {({ navigation }) => (
          <SavedScreen onOpenVideo={(videoId) => navigation.navigate('Video', { videoId })} />
        )}
      </AuthenticatedNav.Screen>
      <AuthenticatedNav.Screen name="Video" options={{ headerShown: true, title: 'Video' }}>
        {({ route, navigation }) => (
          <VideoScreen
            videoId={route.params.videoId}
            onOpenVideo={(videoId) => navigation.replace('Video', { videoId })}
            onOpenChannel={(channelId, title) =>
              navigation.navigate('ChannelVideos', { channelId, title })
            }
          />
        )}
      </AuthenticatedNav.Screen>
      <AuthenticatedNav.Screen
        name="ChannelVideos"
        options={({ route }) => ({ headerShown: true, title: route.params.title })}
      >
        {({ route, navigation }) => (
          <ChannelVideosScreen
            channelId={route.params.channelId}
            onOpenVideo={(videoId) => navigation.navigate('Video', { videoId })}
          />
        )}
      </AuthenticatedNav.Screen>
    </AuthenticatedNav.Navigator>
  );
}

function MainTabs({
  onLogout,
  onOpenSearch,
  onOpenSaved,
  onOpenVideo,
  onOpenChannel,
}: MainTabsProps) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        tabBarStyle: appStyles.tabBar,
        tabBarActiveTintColor: colors.white,
        tabBarInactiveTintColor: '#767676',
        tabBarLabelStyle: appStyles.tabLabel,
        tabBarIcon: ({ color, size, focused }) => {
          const iconMap: Record<keyof TabsParamList, keyof typeof Ionicons.glyphMap> =
            {
              Home: 'home-outline',
              Channels: 'albums-outline',
              Upload: 'add',
              Reels: 'videocam-outline',
              Profile: 'person-outline',
            };

          if (route.name === 'Upload') {
            return (
              <View
                style={[
                  appStyles.uploadTabButton,
                  focused && appStyles.uploadTabButtonActive,
                ]}
              >
                <Ionicons name="add" size={30} color={colors.white} />
              </View>
            );
          }

          return (
            <Ionicons
              name={iconMap[route.name]}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen name="Home" options={{ headerShown: false }}>
        {() => <HomeScreen onOpenSearch={onOpenSearch} onOpenVideo={onOpenVideo} />}
      </Tab.Screen>
      <Tab.Screen name="Channels" options={{ headerShown: false }}>
        {() => <ChannelsScreen onOpenChannel={onOpenChannel} />}
      </Tab.Screen>
      <Tab.Screen
        name="Upload"
        component={UploadScreen}
        options={{ headerShown: false }}
      />
      <Tab.Screen name="Reels" options={{ headerShown: false }}>
        {() => <ReelsScreen onOpenSaved={onOpenSaved} />}
      </Tab.Screen>
      <Tab.Screen name="Profile" options={{ headerShown: false }}>
        {() => (
          <ProfileScreen
            onOpenSaved={onOpenSaved}
            onOpenVideo={onOpenVideo}
            onLogout={onLogout}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default App;
