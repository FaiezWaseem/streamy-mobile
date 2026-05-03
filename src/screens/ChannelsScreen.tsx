import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';

import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { appStyles, colors } from '../utils/theme';

type Props = {
  onOpenChannel: (channelId: string, title: string) => void;
};

export function ChannelsScreen({ onOpenChannel }: Props) {
  const [query, setQuery] = useState('');
  const { channels, refreshLibrary, isLoading } = useLocalLibrary();

  const filteredChannels = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (!search) {
      return channels;
    }

    return channels.filter((channel) =>
      channel.title.toLowerCase().includes(search)
    );
  }, [channels, query]);

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
        <Pressable style={appStyles.primaryButton} onPress={refreshLibrary}>
          <Text style={appStyles.primaryButtonText}>
            {isLoading ? 'Scanning videos...' : 'Refresh Local Videos'}
          </Text>
        </Pressable>

        {filteredChannels.map((channel) => (
          <Pressable
            key={channel.id}
            style={appStyles.channelListCard}
            onPress={() => onOpenChannel(channel.id, channel.title)}
          >
            <View style={appStyles.channelListIcon}>
              <Ionicons name="folder-open-outline" size={24} color={colors.white} />
            </View>
            <View style={appStyles.channelListBody}>
              <Text style={appStyles.channelListTitle}>{channel.title}</Text>
              <Text style={appStyles.channelListMeta}>{channel.videos} videos</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        ))}

        {!filteredChannels.length ? (
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
