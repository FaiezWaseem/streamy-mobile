import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  Pressable,
  Image,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { VideoCard } from '../components/VideoCard';
import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { useServerLibrary } from '../contexts/ServerLibraryContext';
import { appStyles, colors } from '../utils/theme';

type Props = {
  initialTag?: string;
  onOpenVideo: (videoId: string) => void;
};

export function SearchScreen({ initialTag, onOpenVideo }: Props) {
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const { videos: localVideos } = useLocalLibrary();
  const server = useServerLibrary();
  const videos = useMemo(() => [...localVideos, ...server.videos], [localVideos, server.videos]);
  useFocusEffect(useCallback(() => {
    if (server.connected) void server.refresh().catch(() => undefined);
  }, [server.connected, server.refresh]));
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'videos' | 'tags' | 'actors'>(initialTag ? 'tags' : 'videos');
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTag ? [initialTag] : []);
  const [selectedActors, setSelectedActors] = useState<number[]>([]);
  const actorOptions = useMemo(() => Array.from(new Map([...server.actors, ...videos.flatMap(video => video.actors ?? [])].map(actor => [actor.id, actor])).values()).sort((a,b)=>a.name.localeCompare(b.name)), [server.actors, videos]);
  useEffect(() => {
    if (initialTag) { setFilterMode('tags'); setSelectedTags([initialTag]); setQuery(''); }
  }, [initialTag]);
  const results = useMemo(() => {
    const search = query.trim().toLowerCase();

    if (filterMode === 'tags') return videos.filter(video => selectedTags.length ? selectedTags.every(tag => (video.tags ?? []).includes(tag)) : (video.tags ?? []).length > 0);
    if (filterMode === 'actors') return videos.filter(video => selectedActors.length ? selectedActors.every(id => (video.actors ?? []).some(actor => actor.id === id)) : (video.actors ?? []).length > 0);
    if (!search) {
      return videos;
    }

    return videos.filter((video) =>
      [video.title, video.creator, video.channelTitle, video.description, ...(video.tags ?? [])]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(search)) || (video.actors ?? []).some(actor => actor.name.toLowerCase().includes(search))
    );
  }, [query, videos, filterMode, selectedTags, selectedActors]);

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.pageContent}>
        <View style={appStyles.toggleRow}>
          <Pressable style={[appStyles.toggleButton, filterMode === 'videos' && appStyles.toggleButtonActive]} onPress={() => setFilterMode('videos')}><Text style={appStyles.toggleButtonText}>Videos</Text></Pressable>
          <Pressable style={[appStyles.toggleButton, filterMode === 'tags' && appStyles.toggleButtonActive]} onPress={() => setFilterMode('tags')}><Text style={appStyles.toggleButtonText}>Filter by tags</Text></Pressable>
          <Pressable style={[appStyles.toggleButton, filterMode === 'actors' && appStyles.toggleButtonActive]} onPress={() => setFilterMode('actors')}><Text style={appStyles.toggleButtonText}>Filter by actors</Text></Pressable>
        </View>
        {filterMode === 'videos' ? <TextInput
          value={query}
          onChangeText={setQuery}
          style={appStyles.searchInput}
          placeholder="Search local and cloud videos"
          placeholderTextColor={colors.textMuted}
        /> : filterMode === 'tags' ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Array.from(new Set(videos.flatMap(video => video.tags ?? []))).sort().map(tag => {
            const active = selectedTags.includes(tag);
            return <Pressable key={tag} onPress={() => setSelectedTags(current => active ? current.filter(value => value !== tag) : [...current, tag])} style={{ backgroundColor: active ? colors.accent : colors.surfaceSoft, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 }}><Text style={{ color: colors.white }}>{active ? '✓ ' : ''}{tag}</Text></Pressable>;
          })}
          {!videos.some(video => video.tags?.length) ? <Text style={{ color: colors.textMuted }}>No tags yet. Add tags on videos to filter by them.</Text> : null}
        </View> : <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {actorOptions.map(actor => { const active=selectedActors.includes(actor.id); return <Pressable key={actor.id} onPress={()=>setSelectedActors(current=>active?current.filter(id=>id!==actor.id):[...current,actor.id])} style={{flexDirection:'row',alignItems:'center',gap:7,backgroundColor:active?colors.accent:colors.surfaceSoft,borderRadius:22,paddingHorizontal:11,paddingVertical:7}}>{actor.profile_image?<Image source={{uri:actor.profile_image}} style={{width:25,height:25,borderRadius:13}}/>:null}<Text style={{color:colors.white}}>{active?'✓ ':''}{actor.name}</Text></Pressable>; })}
          {!actorOptions.length?<Text style={{color:colors.textMuted}}>No shared actors yet. Add actor profiles from Profile.</Text>:null}
        </View>}
        {filterMode === 'videos' ? <View style={appStyles.toggleRow}>
          <Pressable
            style={[
              appStyles.toggleButton,
              layout === 'grid' && appStyles.toggleButtonActive,
            ]}
            onPress={() => setLayout('grid')}
          >
            <Ionicons name="grid-outline" size={18} color={colors.white} />
            <Text style={appStyles.toggleButtonText}>Grid</Text>
          </Pressable>
          <Pressable
            style={[
              appStyles.toggleButton,
              layout === 'list' && appStyles.toggleButtonActive,
            ]}
            onPress={() => setLayout('list')}
          >
            <Ionicons name="list-outline" size={18} color={colors.white} />
            <Text style={appStyles.toggleButtonText}>List</Text>
          </Pressable>
        </View> : null}
        <Text style={appStyles.sectionTitle}>{filterMode === 'tags' ? 'Videos matching tags' : filterMode==='actors'?'Videos matching actors':'Videos'}</Text>
        {server.isLoading || server.error ? (
          <View style={[appStyles.formStatus, appStyles.formStatusInfo]}>
            <Text style={appStyles.formStatusText}>{server.error ?? 'Refreshing cloud videos…'}</Text>
          </View>
        ) : null}
        {results.length ? (
          <View
            style={
              layout === 'grid' ? appStyles.searchResultsGrid : appStyles.searchResultsList
            }
          >
            {results.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                layout={layout === 'list' ? 'home' : 'grid'}
                onPress={onOpenVideo}
              />
            ))}
          </View>
        ) : !server.isLoading ? (
          <View style={appStyles.emptyState}>
            <Text style={appStyles.emptyStateTitle}>No matching videos</Text>
            <Text style={appStyles.emptyStateText}>
              Try another keyword, scan a local folder, or connect your server in Profile.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
