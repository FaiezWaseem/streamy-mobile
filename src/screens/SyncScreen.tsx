import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, FlatList, Pressable, Text, View, StyleSheet } from 'react-native';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { useServerLibrary } from '../contexts/ServerLibraryContext';
import { useSync } from '../contexts/SyncContext';
import { appStyles, colors } from '../utils/theme';

export function SyncScreen({ channelId, onOpenVideo }: { channelId?: string; onOpenVideo: (id: string) => void }) {
  const local = useLocalLibrary();
  const server = useServerLibrary();
  const sync = useSync();
  const [message, setMessage] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  useFocusEffect(useCallback(() => { if (server.connected) void server.refresh().catch(() => undefined); }, [server.connected, server.refresh]));
  const folders = local.channels.filter(channel => channel.id.startsWith('directory-')).sort((a, b) => Number(b.id === channelId) - Number(a.id === channelId));
  const knownIds = new Set(sync.jobs.filter(job => job.status === 'synced').map(job => job.serverId));
  const otherCloud = server.videos.filter(video => !knownIds.has(video.id));
  const completed = sync.jobs.filter(job => job.status === 'synced').length;
  const pending = sync.jobs.filter(job => job.status === 'queued' || job.status === 'uploading').length;
  const queued = sync.jobs.filter(job => job.status === 'queued').length;
  const paused = sync.jobs.filter(job => job.status === 'paused').length;
  async function queueFolder(id: string) {
    setAdding(true);
    try {
      const count = await sync.queueVideos(local.getChannelVideos(id));
      setMessage(count ? `${count} videos queued. Local files will be kept.` : 'All available videos in this folder are already synced or queued.');
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not queue this directory.'); }
    finally { setAdding(false); }
  }
  function confirmFolder(id: string, title: string) {
    const count = local.getChannelVideos(id).length;
    Alert.alert('Sync directory', `Upload ${count} videos from “${title}”? Videos already synced by this app will be skipped. Local files will be kept.`, [
      { text: 'Cancel', style: 'cancel' }, { text: 'Sync directory', onPress: () => void queueFolder(id) },
    ]);
  }
  const header = <View style={styles.header}>
    <Text style={appStyles.sectionTitle}>Sync videos</Text>
    <Text style={appStyles.sectionMeta}>{completed} synced · {pending} queued or uploading · {paused} paused · up to 2 simultaneous uploads</Text>
    <Text style={styles.note}>Uploads continue as you move between screens. Keep the app open while syncing. Interrupted uploads can be retried.</Text>
    {!server.connected ? <Text style={styles.note}>Connect your server in Profile to start syncing.</Text> : null}
    {message || sync.storageError ? <Text style={styles.note}>{sync.storageError ?? message}</Text> : null}
    {queued ? <Pressable style={appStyles.secondaryButton} onPress={() => void sync.pauseQueued()}><Text style={appStyles.secondaryButtonText}>Pause {queued} queued</Text></Pressable> : null}
    {paused ? <Pressable style={appStyles.primaryButton} onPress={() => void sync.resumePaused()}><Text style={appStyles.primaryButtonText}>Resume {paused} paused</Text></Pressable> : null}
    <View>
      {!folders.length ? <Text style={styles.note}>Use Scan Directory on Home first, then select that folder here.</Text> : folders.map(folder => <View key={folder.id} style={styles.card}>
        <Text style={styles.title}>{folder.title}</Text><Text style={styles.note}>{folder.videos} videos</Text>
        <Pressable style={styles.folderSync} accessibilityLabel={`Sync ${folder.title}`} disabled={adding || !sync.ready || !server.connected} onPress={() => confirmFolder(folder.id, folder.title)}><Ionicons name="cloud-upload-outline" size={22} color={colors.white} /></Pressable>
      </View>)}
    </View>
    <Text style={appStyles.sectionTitle}>Upload history</Text>
  </View>;
  return <FlatList style={appStyles.screen} contentContainerStyle={styles.list} data={[...sync.jobs].sort((a, b) => b.updatedAt - a.updatedAt)} keyExtractor={job => job.id}
    ListHeaderComponent={header} ListEmptyComponent={<Text style={styles.note}>{sync.ready ? 'New uploads will appear here with their progress.' : 'Loading sync history…'}</Text>}
    renderItem={({ item: job }) => {
      const percent = job.total ? Math.floor(job.sent / job.total * 100) : 0;
      const label = job.status === 'synced' ? 'Synced · 100%' : job.status === 'uploading' ? (percent === 100 ? 'Finishing on server…' : `Uploading · ${percent}%`) : job.status === 'queued' ? 'Queued' : job.status === 'paused' ? 'Paused' : job.status === 'interrupted' ? 'Interrupted' : 'Failed';
      return <View style={styles.card}>
        <Text style={styles.title} numberOfLines={2}>{job.video.title}</Text><Text style={styles.note}>{job.video.channelTitle ?? job.video.creator}</Text>
        <Text style={[styles.badge, job.status === 'synced' && { color: '#60d394' }]}>{label}</Text>
        <View style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View>
        {job.total > 0 ? <Text style={styles.note}>{(job.sent / 1048576).toFixed(1)} / {(job.total / 1048576).toFixed(1)} MB</Text> : null}
        {job.error ? <Text style={styles.note}>{job.error}</Text> : null}
        {job.status === 'failed' || job.status === 'interrupted' ? <Pressable disabled={!server.connected} style={appStyles.secondaryButton} onPress={() => void sync.retry(job.id).catch(cause => setMessage(String(cause.message)))}><Text style={appStyles.secondaryButtonText}>Retry</Text></Pressable> : null}
        {job.status === 'synced' && job.serverId ? <Pressable style={appStyles.secondaryButton} onPress={() => { if (server.getVideoById(job.serverId!)) onOpenVideo(job.serverId!); else setMessage('Refresh the server library in Profile to open this video.'); }}><Text style={appStyles.secondaryButtonText}>Open cloud video</Text></Pressable> : null}
      </View>;
    }} ListFooterComponent={<View>
      {otherCloud.length ? <Text style={appStyles.sectionTitle}>Already on server · {otherCloud.length}</Text> : null}
      {otherCloud.map(video => <Pressable key={video.id} style={styles.card} onPress={() => onOpenVideo(video.id)}><Text style={styles.title}>{video.title}</Text><Text style={[styles.badge, { color: '#60d394' }]}>On server</Text></Pressable>)}
    </View>} />;
}
const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 40 }, header: { gap: 12, marginBottom: 16 },
  card: { padding: 16, borderRadius: 14, backgroundColor: colors.surface, marginBottom: 12, gap: 8 },
  title: { color: colors.text, fontWeight: '700', fontSize: 15 }, note: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
  badge: { color: colors.text, fontWeight: '600' }, track: { backgroundColor: '#333', height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { backgroundColor: '#e50914', height: 5 }, folderSync: { position: 'absolute', right: 14, top: 18, padding: 8 },
});
