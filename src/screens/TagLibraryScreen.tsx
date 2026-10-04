import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { useServerLibrary } from '../contexts/ServerLibraryContext';
import { Pressable, SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { addAvailableTags, getAvailableTags, removeAvailableTag } from '../utils/database';
import { normalizeTags } from '../utils/recommendations';
import { useSQLiteContext } from 'expo-sqlite';
import { appStyles, colors } from '../utils/theme';
export function TagLibraryScreen() {
  const db = useSQLiteContext();
  const server = useServerLibrary();
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [message, setMessage] = useState('');
  const reload = useCallback(async () => setTags(await getAvailableTags(db)), [db]);
  useFocusEffect(useCallback(() => { void reload(); if (server.connected) void server.refresh().catch(() => undefined); }, [reload, server.connected, server.refresh]));
  useEffect(() => { setTags(current => Array.from(new Set([...current, ...server.availableTags])).sort()); }, [server.availableTags]);
  async function add() {
    const values = normalizeTags(draft);
    if (!values.length) return;
    await addAvailableTags(db, values);
    if (server.connected) await server.addAvailableTags(values);
    setDraft(''); setMessage(server.connected ? `${values.length} tag${values.length === 1 ? '' : 's'} saved to your shared library.` : 'Saved on this device. Connect to share these tags with the web.'); await reload();
  }
  async function remove(tag: string) {
    await removeAvailableTag(db, tag); if (server.connected) await server.removeAvailableTag(tag); setTags(current => current.filter(value => value !== tag));
  }
  return <SafeAreaView style={appStyles.screen}><ScrollView contentContainerStyle={appStyles.pageContent}>
    <Text style={appStyles.sectionTitle}>Tag library</Text>
    <Text style={appStyles.sectionMeta}>Add your tags here, then select them when editing a video.</Text>
    <TextInput value={draft} onChangeText={setDraft} style={appStyles.searchInput} placeholder="funny, thriller, english" placeholderTextColor={colors.textMuted} />
    <Pressable style={appStyles.primaryButton} onPress={() => void add()}><Text style={appStyles.primaryButtonText}>Add tags</Text></Pressable>
    {!!message && <Text style={appStyles.sectionMeta}>{message}</Text>}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      {tags.map(tag => <View key={tag} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surfaceSoft }}>
        <Text style={{ color: colors.text }}>{tag}</Text><Pressable onPress={() => void remove(tag)} accessibilityLabel={`Remove ${tag}`}><Ionicons name="close-circle" size={18} color={colors.textMuted} /></Pressable>
      </View>)}
    </View>
    {!tags.length && <Text style={appStyles.sectionMeta}>No custom tags yet. Add several at once with commas.</Text>}
  </ScrollView></SafeAreaView>;
}
