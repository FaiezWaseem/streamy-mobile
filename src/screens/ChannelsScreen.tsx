import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';

import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { useServerLibrary } from '../contexts/ServerLibraryContext';
import { appStyles, colors } from '../utils/theme';

type Props = {
  onOpenSync: (channelId?: string) => void;
  onOpenChannel: (channelId: string, title: string) => void;
};

export function ChannelsScreen({ onOpenChannel, onOpenSync }: Props) {
  const [query, setQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const { channels: localChannels, rescanScannedDirectories, isLoading, deleteChannel } = useLocalLibrary();
  const server = useServerLibrary();
  const channels = useMemo(() => [
    ...localChannels.map((channel) => ({ ...channel, source: 'local' })),
    ...server.channels.map((channel) => ({ ...channel, source: 'cloud' })),
  ], [localChannels, server.channels]);
  useFocusEffect(useCallback(() => {
    if (server.connected) void server.refresh().catch(() => undefined);
  }, [server.connected, server.refresh]));

  const filteredChannels = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return channels;
    }

    return channels.filter((channel) =>
      channel.title.toLowerCase().includes(search)
    );
  }, [channels, query]);

  function handleDeleteChannel(channelId: string, title: string) {
    Alert.alert(
      'Remove channel',
      `Remove "${title}" from Streamy?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteChannel(channelId);
            setStatusMessage(result.message);
          },
        },
      ]
    );
  }

  async function handleRescanLibrary() {
    setStatusMessage(null);
    const result = await rescanScannedDirectories();

    setStatusMessage(
      result.total
        ? `Rescanned ${result.imported} cached videos from local directories.`
        : 'No scanned directories found yet. Use Scan Directory from Home first.'
    );
  }

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={appStyles.pageContent}>
        <View style={appStyles.inlineHeader}>
          <Ionicons name="menu" size={28} color={colors.text} />
          <Text style={appStyles.pageTitle}>Channels</Text>
        </View>
        <TextInput
          value={query}
          onChangeText={setQuery}
          style={appStyles.searchInput}
          placeholder="Search channels"
          placeholderTextColor={colors.textMuted}
        />
        <Pressable
          style={appStyles.primaryButton}
          onPress={() => {
            void handleRescanLibrary();
          }}
          disabled={isLoading}
        >
          <Text style={appStyles.primaryButtonText}>
            {isLoading ? 'Scanning videos...' : 'Rescan Local Videos'}
          </Text>
        </Pressable>
        {statusMessage ? (
          <View style={[appStyles.formStatus, appStyles.formStatusInfo]}>
            <Text style={appStyles.formStatusText}>{statusMessage}</Text>
          </View>
        ) : null}

        {server.isLoading || server.error ? (
          <View style={[appStyles.formStatus, appStyles.formStatusInfo]}>
            <Text style={appStyles.formStatusText}>{server.error ?? 'Refreshing cloud channels…'}</Text>
          </View>
        ) : null}
        {filteredChannels.map((channel) => (
          <View key={channel.id} style={appStyles.channelListCard}>
            <Pressable
              style={appStyles.channelListPressable}
              onPress={() => onOpenChannel(channel.id, channel.title)}
            >
              <View style={appStyles.channelListIcon}>
                <Ionicons name={channel.source === 'cloud' ? 'cloud-outline' : 'folder-open-outline'} size={24} color={colors.white} />
              </View>
              <View style={appStyles.channelListBody}>
                <Text style={appStyles.channelListTitle}>{channel.title}</Text>
                <Text style={appStyles.channelListMeta}>{channel.videos} videos · {channel.source === 'cloud' ? 'Cloud' : 'Local'}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
            {channel.source === 'local' && channel.id.startsWith('directory-') ? <Pressable style={appStyles.secondaryButton} onPress={() => onOpenSync(channel.id)}><Text style={appStyles.secondaryButtonText}>Sync directory</Text></Pressable> : null}
            {channel.source === 'local' ? <Pressable
              style={appStyles.channelDeleteButton}
              onPress={() => handleDeleteChannel(channel.id, channel.title)}
            >
              <Ionicons name="trash-outline" size={18} color={colors.white} />
              <Text style={appStyles.channelDeleteButtonText}>Remove</Text>
            </Pressable> : null}
          </View>
        ))}

        {!filteredChannels.length && !server.isLoading ? (
          <View style={appStyles.emptyState}>
            <Text style={appStyles.emptyStateTitle}>No channels found</Text>
            <Text style={appStyles.emptyStateText}>
              Try a different keyword or clear the search to see all channels.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
