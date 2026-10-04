import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { VideoCard } from '../components/VideoCard';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { useSync } from '../contexts/SyncContext';
import { useServerLibrary } from '../contexts/ServerLibraryContext';
import {
  getInterestHistory,
  getAvailableTags,
  isVideoLiked,
  isVideoSaved,
  likeVideo,
  recordVideoView,
  saveVideo,
  unlikeVideo,
  unsaveVideo,
} from '../utils/database';
import { appStyles, colors } from '../utils/theme';
import { type VideoItem } from '../utils/types';
import { normalizeTags, rankVideos, newWatchId, type InterestWatch } from '../utils/recommendations';
import { isLocalMediaUri } from '../utils/localFiles';

type Props = {
  videoId: string;
  onOpenVideo: (videoId: string) => void;
  onOpenChannel: (channelId: string, title: string) => void;
  onOpenTag: (tag: string) => void;
};

function fallbackChannelId(value: string) {
  return `channel-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

export function VideoScreen({ videoId, onOpenVideo, onOpenChannel, onOpenTag }: Props) {
  const { getVideoById } = useLocalLibrary();
  const { getVideoById: getServerVideoById } = useServerLibrary();
  const video = getVideoById(videoId) ?? getServerVideoById(videoId);
  if (!video) {
    return (
      <SafeAreaView style={appStyles.screen}>
        <View style={appStyles.pageContent}>
          <Text style={appStyles.emptyStateTitle}>Video unavailable</Text>
          <Text style={appStyles.emptyStateText}>Return to your library to select a video.</Text>
        </View>
      </SafeAreaView>
    );
  }
  return <VideoContent key={`${video.id}:${video.video}`} videoId={videoId} video={video} onOpenVideo={onOpenVideo} onOpenChannel={onOpenChannel} onOpenTag={onOpenTag} />;
}

function VideoContent({ video, onOpenVideo, onOpenChannel, onOpenTag }: Props & { video: VideoItem }) {
  const db = useSQLiteContext();
  const { videos, deleteVideo, removeLocalFileAfterSync, updateTags: updateLocalTags, updateActors: updateLocalActors } = useLocalLibrary();
  const server = useServerLibrary();
  const { connected, downloadsInProgress, downloadVideo, removeOfflineVideo } = server;
  const isDownloading = downloadsInProgress.includes(video.id);
  const { upload } = useSync();
  const [tagError, setTagError] = useState<string | null>(null);
  const [editingTags, setEditingTags] = useState(false);
  const [editingActors, setEditingActors] = useState(false);
  const [actorDraft, setActorDraft] = useState<number[]>((video.actors ?? []).map(actor => actor.id));
  const [savingActors, setSavingActors] = useState(false);
  const isFocused = useIsFocused();
  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;
  const mountedRef = useRef(true);
  const [tagDraft, setTagDraft] = useState<string[]>(video.tags ?? []);
  const [sharedTags, setSharedTags] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [interestHistory, setInterestHistory] = useState<InterestWatch[]>([]);
  const videoRef = useRef(video);
  videoRef.current = video;
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<number | null>(null);

  const selectableTags = useMemo(() => Array.from(new Set([...sharedTags, ...server.availableTags, ...videos.flatMap(item => item.tags ?? []), ...server.videos.flatMap(item => item.tags ?? []), ...(video.tags ?? [])])).sort((a, b) => a.localeCompare(b)), [sharedTags, server.availableTags, videos, server.videos, video.tags]);
  const relatedVideos = useMemo(
    () => rankVideos([...videos, ...server.videos], [...server.history, ...interestHistory], video).slice(0, 12),
    [video, videos, server.videos, server.history, interestHistory]
  );
  const playerSource = useMemo(
    () => video.authToken ? { uri: video.video, headers: { Authorization: `Bearer ${video.authToken}` } } : video.video,
    [video.authToken, video.video]
  );
  const player = useVideoPlayer(playerSource, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.bufferOptions = {
      preferredForwardBufferDuration: 6,
      minBufferForPlayback: 0.5,
      prioritizeTimeOverSizeThreshold: true,
    };
    videoPlayer.pause();
  });

  // useVideoPlayer owns native creation and release. Never access it in unmount cleanup.
  useEffect(() => {
    if (!isFocused) player.pause();
  }, [isFocused, player]);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    async function syncHistory() {
      await recordVideoView(db, video);
      const history = await getInterestHistory(db, server.accountKey);
      if (mountedRef.current) setInterestHistory(history);
    }

    void syncHistory().catch(() => undefined);
  }, [db, video.id, server.accountKey]);

  useEffect(() => { setTagDraft(video.tags ?? []); }, [video.tags]);
  useEffect(() => { void getAvailableTags(db).then(setSharedTags).catch(() => undefined); }, [db]);
  useEffect(() => {
    player.timeUpdateEventInterval = 1;
    let lastTime = player.currentTime, seconds = 0, recorded = false;
    const eventId = newWatchId();
    let active = true;
    const subscription = player.addListener('timeUpdate', ({ currentTime }) => {
      if (!active || !focusedRef.current) return;
      const delta = currentTime - lastTime;
      lastTime = currentTime;
      if (recorded || !player.playing || delta <= 0 || delta > 2) return;
      seconds += delta;
      const duration = player.duration;
      const threshold = duration > 0 ? Math.min(10, Math.max(1, duration * 0.2)) : 10;
      if (seconds < threshold) return;
      recorded = true;
      const current = videoRef.current;
      const event: InterestWatch = { event_id: eventId, video_id: current.id, watched_at: new Date().toISOString(), tags: current.tags ?? [], duration };
      const save = server.recordWatch(event, seconds);
      void save.then(() => { if (mountedRef.current) setInterestHistory(history => [event, ...history]); }).catch(() => undefined);
    });
    return () => {
      active = false;
      // Expo may already have released the shared object during unmount.
      try { subscription.remove(); } catch { /* Its listeners are already disposed. */ }
    };
  }, [db, player, video.id, server.recordWatch]);

  async function handleSaveTags() {
    setTagError(null);
    setSavingTags(true);
    try {
      const tags = normalizeTags(tagDraft);
      if (video.source === 'server') await server.updateTags(video.id, tags);
      else await updateLocalTags(video.id, tags);
      if (!mountedRef.current) return;
      setTagDraft(tags); setEditingTags(false); setActionMessage('Tags saved.');
    } catch (error) { if (mountedRef.current) setTagError(error instanceof Error ? error.message : 'Could not save tags.'); }
    finally { if (mountedRef.current) setSavingTags(false); }
  }

  async function handleSaveActors() {
    setSavingActors(true); setTagError(null);
    try {
      const selected=server.actors.filter(actor=>actorDraft.includes(actor.id));
      if(video.source==='server') await server.updateVideoActors(video.id,actorDraft); else await updateLocalActors(video.id,selected);
      if (mountedRef.current) { setEditingActors(false); setActionMessage('Actors saved.'); }
    }
    catch(error) { if(mountedRef.current) setTagError(error instanceof Error?error.message:'Could not save actors.'); }
    finally { if(mountedRef.current) setSavingActors(false); }
  }

  useFocusEffect(
    useCallback(() => {
      let active = true;
      async function syncTrackedState() {
        const [nextLiked, nextSaved] = await Promise.all([isVideoLiked(db, video.id), isVideoSaved(db, video.id)]);
        if (!active) return;
        setLiked(nextLiked); setSaved(nextSaved); setActionMessage(null);
      }
      void syncTrackedState().catch(() => undefined);
      return () => { active = false; };
    }, [db, video.id])
  );

  async function handleToggleLike() {
    console.log('[video] like button tapped', { videoId: video.id, title: video.title });
    const nextLiked = !liked;
    setLiked(nextLiked);

    try {
      if (nextLiked) {
        await likeVideo(db, video);
        const confirmed = await isVideoLiked(db, video.id);
        setLiked(confirmed);
        setActionMessage(confirmed ? 'Added to liked videos.' : 'Could not like this video.');
        console.log('[video] liked video', {
          videoId: video.id,
          title: video.title,
          confirmed,
        });
        return;
      }

      await unlikeVideo(db, video.id);
      const confirmed = await isVideoLiked(db, video.id);
      setLiked(confirmed);
      setActionMessage(!confirmed ? 'Removed from liked videos.' : 'Could not remove like.');
      console.log('[video] unliked video', {
        videoId: video.id,
        title: video.title,
        confirmed,
      });
    } catch (error) {
      console.log('[video] failed to toggle like', {
        videoId: video.id,
        title: video.title,
        error,
      });
      setLiked(!nextLiked);
      setActionMessage('Failed to update liked videos.');
    }
  }

  async function handleToggleSave() {
    console.log('[video] save button tapped', { videoId: video.id, title: video.title });
    const nextSaved = !saved;
    setSaved(nextSaved);

    try {
      if (nextSaved) {
        await saveVideo(db, video);
        const confirmed = await isVideoSaved(db, video.id);
        setSaved(confirmed);
        setActionMessage(confirmed ? 'Saved to your library.' : 'Could not save this video.');
        console.log('[video] saved video', {
          videoId: video.id,
          title: video.title,
          confirmed,
        });
        return;
      }

      await unsaveVideo(db, video.id);
      const confirmed = await isVideoSaved(db, video.id);
      setSaved(confirmed);
      setActionMessage(!confirmed ? 'Removed from your saved videos.' : 'Could not remove save.');
      console.log('[video] unsaved video', {
        videoId: video.id,
        title: video.title,
        confirmed,
      });
    } catch (error) {
      console.log('[video] failed to toggle save', {
        videoId: video.id,
        title: video.title,
        error,
      });
      setSaved(!nextSaved);
      setActionMessage('Failed to update saved videos.');
    }
  }

  function handleOpenChannel() {
    const title = video.channelTitle ?? video.creator;
    const channelId = video.channelId ?? fallbackChannelId(title);
    onOpenChannel(channelId, title);
  }

  function handleDeleteVideo() {
    if (video.source === 'server') return;
    Alert.alert(
      'Remove video',
      `Remove "${video.title}" from Streamy?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteVideo(video.id);
            setActionMessage(result.message);
          },
        },
      ]
    );
  }

  async function handleDownload() {
    setActionMessage(null);
    try { await downloadVideo(video.id); setActionMessage('Saved for offline playback.'); }
    catch (cause) { setActionMessage(cause instanceof Error ? cause.message : 'Download failed.'); }
  }
  async function handleRemoveOffline() {
    Alert.alert('Remove download', 'Delete the saved offline copy from this device?', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete download', style: 'destructive', onPress: () => void removeOfflineVideo(video.id) },
    ]);
  }

  async function syncToServer(deleteLocal: boolean) {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncProgress(0);
    setActionMessage(null);
    player.pause();
    try {
      const serverVideoId = await upload(video, (sent, total) => setSyncProgress(Math.floor((sent / total) * 100)));
      if (!deleteLocal) {
        setActionMessage('Synced to cloud. Your local video was kept on this device.');
        return;
      }
      const removed = await removeLocalFileAfterSync(video.id);
      if (removed) {
        onOpenVideo(serverVideoId);
      } else {
        setActionMessage('Synced to cloud. The device could not delete the local file, so it was kept.');
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'Sync failed. The local file was kept.');
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }

  function handleSyncAndFreeSpace() {
    Alert.alert(
      'Sync and free up space',
      `Upload “${video.title}” to your server. After the upload succeeds, delete its local file from this device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upload and delete local', style: 'destructive', onPress: () => void syncToServer(true) },
      ]
    );
  }

  return (
    <SafeAreaView style={appStyles.screen}>
      <Modal visible={editingTags} transparent animationType="fade" onRequestClose={() => setEditingTags(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <View style={{ width: '100%', maxWidth: 480, backgroundColor: colors.surface, borderRadius: 18, padding: 20, gap: 16 }}>
            <Text style={appStyles.videoDescriptionHeading}>Edit tags</Text>
            <Text style={appStyles.videoDescriptionText}>Select from your tag library. Add tags in Profile → Manage tags.</Text>
            <ScrollView style={{ maxHeight: 300 }}><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {selectableTags.map(tag => {
                const selected = tagDraft.includes(tag);
                return <Pressable key={tag} disabled={savingTags} onPress={() => setTagDraft(current => selected ? current.filter(value => value !== tag) : current.length < 20 ? [...current, tag] : current)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: selected ? colors.accent : colors.surfaceSoft }}><Text style={{ color: colors.white }}>{selected ? '✓ ' : ''}{tag}</Text></Pressable>;
              })}
              {!selectableTags.length ? <Text style={appStyles.videoDescriptionText}>No tags yet. Add some from Profile → Manage tags.</Text> : null}
            </View></ScrollView>
            {tagError ? <Text style={{ color: colors.accent }}>{tagError}</Text> : null}
            <Pressable style={appStyles.primaryButton} disabled={savingTags} onPress={() => void handleSaveTags()}>
              <Text style={appStyles.primaryButtonText}>{savingTags ? 'Saving…' : 'Save tags'}</Text>
            </Pressable>
            <Pressable style={appStyles.secondaryButton} disabled={savingTags} onPress={() => setEditingTags(false)}>
              <Text style={appStyles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={editingActors} transparent animationType="fade" onRequestClose={() => setEditingActors(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.75)' }}>
          <View style={{ width: '100%', maxWidth: 480, backgroundColor: colors.surface, borderRadius: 18, padding: 20, gap: 16 }}>
            <Text style={appStyles.videoDescriptionHeading}>Edit actors</Text>
            <ScrollView style={{maxHeight:320}}><View style={{gap:8}}>{server.actors.map(actor=>{const active=actorDraft.includes(actor.id);return <Pressable key={actor.id} disabled={savingActors} onPress={()=>setActorDraft(current=>active?current.filter(id=>id!==actor.id):[...current,actor.id])} style={{flexDirection:'row',alignItems:'center',gap:10,backgroundColor:active?colors.surfaceSoft:colors.background,padding:10,borderRadius:12}}>{actor.profile_image?<Image source={{uri:actor.profile_image}} style={{width:36,height:36,borderRadius:18}}/>:null}<Text style={{color:colors.text}}>{active?'✓  ':''}{actor.name}</Text></Pressable>;})}{!server.actors.length?<Text style={appStyles.videoDescriptionText}>Create actor profiles from Profile → Manage actors.</Text>:null}</View></ScrollView>
            {tagError?<Text style={{color:colors.accent}}>{tagError}</Text>:null}
            <Pressable style={appStyles.primaryButton} disabled={savingActors} onPress={()=>void handleSaveActors()}><Text style={appStyles.primaryButtonText}>{savingActors?'Saving…':'Save actors'}</Text></Pressable>
            <Pressable style={appStyles.secondaryButton} disabled={savingActors} onPress={()=>setEditingActors(false)}><Text style={appStyles.secondaryButtonText}>Cancel</Text></Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <VideoView
        player={player}
        style={appStyles.videoHero}
        contentFit="cover"
        nativeControls
        allowsFullscreen
      />
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={appStyles.videoPageBody}>
          <Text style={appStyles.videoPageTitle}>{video.title}</Text>
          <Text style={appStyles.videoPageMeta}>
            {video.views} · {video.published}
          </Text>

          {(video.actors ?? []).length || video.canEdit ? <View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:6,marginBottom:4}}>
            {(video.actors??[]).map(actor=><View key={actor.id} style={{flexDirection:'row',alignItems:'center',gap:5,backgroundColor:colors.surface,paddingHorizontal:9,paddingVertical:4,borderRadius:18}}>{actor.profile_image?<Image source={{uri:actor.profile_image}} style={{width:20,height:20,borderRadius:10}}/>:null}<Text style={{color:colors.text}}>{actor.name}</Text></View>)}
            {(video.canEdit||video.source!=='server')?<Pressable onPress={()=>{setTagError(null);setActorDraft((video.actors??[]).map(actor=>actor.id));setEditingActors(true);}} style={{flexDirection:'row',alignItems:'center',gap:5,padding:8}}><Ionicons name="pencil-outline" size={16} color={colors.textMuted}/><Text style={{color:colors.textMuted}}>Edit actors</Text></Pressable>:null}
          </View>:null}

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {(video.tags ?? []).map(tag => <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`Search videos tagged ${tag}`} onPress={() => onOpenTag(tag)} style={{ backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 }}><Text style={{ color: colors.text }}>{tag}</Text></Pressable>)}
            {video.canEdit || video.source !== 'server' ? (
              <Pressable accessibilityRole="button" onPress={() => { setTagError(null); setTagDraft(video.tags ?? []); setEditingTags(true); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, padding: 8 }}>
                <Ionicons name="pencil-outline" size={16} color={colors.textMuted} />
                <Text style={{ color: colors.textMuted }}>Edit tags</Text>
              </Pressable>
            ) : null}
          </View>

          {video.source !== 'server' ? (
            <View style={appStyles.videoSyncPanel}>
              <Text style={appStyles.videoDescriptionHeading}>Cloud sync</Text>
              <Text style={appStyles.videoDescriptionText}>
                {!connected ? 'Connect your server in Profile to sync this video.' : !isLocalMediaUri(video.video) ? 'Direct video links cannot be uploaded. Select a device video file to sync.' : 'Save a copy on your server, or free device storage after the upload is verified.'}
              </Text>
              <Pressable
                style={[appStyles.primaryButton, (!connected || isSyncing || !isLocalMediaUri(video.video)) && appStyles.primaryButtonDisabled]}
                disabled={!connected || isSyncing || !isLocalMediaUri(video.video)}
                onPress={() => void syncToServer(false)}
              >
                <Text style={appStyles.primaryButtonText}>Sync to cloud</Text>
              </Pressable>
              <Pressable
                style={appStyles.secondaryButton}
                disabled={!connected || isSyncing || !isLocalMediaUri(video.video)}
                onPress={handleSyncAndFreeSpace}
              >
                <Text style={appStyles.secondaryButtonText}>Sync & free space</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={appStyles.videoActionRow}>
            <Pressable
              style={[
                appStyles.videoActionButton,
                liked && appStyles.videoActionButtonActive,
              ]}
              onPress={handleToggleLike}
            >
              <Ionicons
                name={liked ? 'thumbs-up' : 'thumbs-up-outline'}
                size={18}
                color={colors.white}
              />
              <Text style={appStyles.videoActionText}>{liked ? 'Liked' : 'Like'}</Text>
            </Pressable>
            <Pressable
              style={[
                appStyles.videoActionButton,
                saved && appStyles.videoActionButtonActive,
              ]}
              onPress={handleToggleSave}
            >
              <Ionicons
                name={saved ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={colors.white}
              />
              <Text style={appStyles.videoActionText}>{saved ? 'Saved' : 'Save'}</Text>
            </Pressable>
            {video.source === 'server' ? <Pressable
              accessibilityRole="button"
              accessibilityLabel={isDownloading ? 'Downloading video' : video.isDownloaded ? 'Remove offline download' : 'Download for offline playback'}
              disabled={isDownloading || (!video.isDownloaded && !connected)}
              onPress={() => video.isDownloaded ? void handleRemoveOffline() : void handleDownload()}
              style={[appStyles.videoActionButton,{width:42,height:42,padding:0,justifyContent:'center',opacity:isDownloading||(!video.isDownloaded&&!connected)?0.5:1}]}
            >
              {isDownloading ? <ActivityIndicator size="small" color={colors.white}/> : <Ionicons name={video.isDownloaded?'checkmark-circle-outline':'download-outline'} size={20} color={colors.white}/>}
            </Pressable> : null}
            {video.source !== 'server' ? <Pressable style={appStyles.videoActionButton} onPress={handleDeleteVideo}>
              <Ionicons name="trash-outline" size={18} color={colors.white} />
              <Text style={appStyles.videoActionText}>Remove</Text>
            </Pressable> : null}
          </View>
          {actionMessage ? (
            <View style={[appStyles.formStatus, appStyles.formStatusInfo]}>
              <Text style={appStyles.formStatusText}>{actionMessage}</Text>
            </View>
          ) : null}
          {isSyncing ? (
            <View style={[appStyles.formStatus, appStyles.formStatusInfo]}>
              <Text style={appStyles.formStatusText}>{syncProgress === null ? 'Preparing upload…' : `Uploading to server: ${syncProgress}%`}</Text>
            </View>
          ) : null}

          <Pressable style={appStyles.videoChannelCard} onPress={handleOpenChannel}>
            {video.image ? (
              <Image source={{ uri: video.image }} style={appStyles.videoChannelAvatar} />
            ) : (
              <View style={appStyles.videoChannelAvatarPlaceholder}>
                <Text style={appStyles.videoChannelAvatarPlaceholderText}>LV</Text>
              </View>
            )}
            <View style={appStyles.videoChannelMetaWrap}>
              <Text style={appStyles.videoChannelName}>
                {video.channelTitle ?? video.creator}
              </Text>
              <Text style={appStyles.videoChannelSubscribers}>
                {video.subscribers} subscribers
              </Text>
            </View>
            <Pressable style={appStyles.videoSubscribeButton}>
              <Text style={appStyles.videoSubscribeText}>Subscribe</Text>
            </Pressable>
          </Pressable>

          <Text style={appStyles.sectionTitle}>Similar videos</Text>
          <View style={appStyles.searchResultsList}>
            {relatedVideos.map((item) => (
              <VideoCard
                key={item.id}
                video={item}
                layout="home"
                onPress={onOpenVideo}
              />
            ))}
          </View>
          {!relatedVideos.length ? (
            <View style={appStyles.emptyState}>
              <Text style={appStyles.emptyStateTitle}>No more videos in this channel yet</Text>
              <Text style={appStyles.emptyStateText}>
                Scan your library or import more local clips to build out this channel.
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
