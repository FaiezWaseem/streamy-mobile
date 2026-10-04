import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { useLocalLibrary, type DirectoryImportProgress, type DirectorySelection } from '../contexts/LocalLibraryContext';
import { appStyles, colors } from '../utils/theme';

export function DirectoryScanScreen() {
  const { channels, pickDirectory, importPickedDirectory, rescanScannedDirectories, isLoading } = useLocalLibrary();
  const [selection, setSelection] = useState<DirectorySelection | null>(null);
  const [progress, setProgress] = useState<DirectoryImportProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useFocusEffect(useCallback(() => { void rescanScannedDirectories().catch(() => undefined); }, [rescanScannedDirectories]));
  async function scan() {
    setMessage(null);
    try {
      const found = await pickDirectory();
      if (!found) return;
      if (!found.totalVideos) { setMessage('No supported video files were found in that folder.'); return; }
      setSelection(found);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Could not scan that folder.'); }
  }
  async function importFolder() {
    if (!selection) return;
    setProgress({ imported: 0, total: selection.totalVideos, currentFileName: '' });
    setMessage(null);
    try {
      const result = await importPickedDirectory(selection, setProgress);
      setMessage(`Added ${result.imported} videos from “${result.title}” to your library.`);
      setSelection(null);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Folder scan did not finish.'); }
    finally { setProgress(null); }
  }
  return <SafeAreaView style={appStyles.screen}>
    <ScrollView contentContainerStyle={appStyles.pageContent}>
      <Text style={appStyles.sectionTitle}>Scan a directory</Text>
      <Text style={appStyles.sectionMeta}>Choose a device folder and add its videos to your local library.</Text>
      <Pressable style={appStyles.primaryButton} onPress={() => void scan()} disabled={isLoading || !!progress}>
        <Ionicons name="folder-open-outline" size={20} color={colors.white} />
        <Text style={appStyles.primaryButtonText}>{isLoading ? 'Scanning…' : 'Choose directory'}</Text>
      </Pressable>
      {selection ? <View style={appStyles.directoryReviewCard}>
        <Text style={appStyles.sectionTitle}>{selection.title}</Text>
        <Text style={appStyles.sectionMeta}>{selection.totalVideos} supported videos</Text>
        <Text style={appStyles.directoryReviewPath}>{selection.directoryUri}</Text>
        <Pressable style={appStyles.primaryButton} onPress={() => void importFolder()} disabled={isLoading}>
          <Text style={appStyles.primaryButtonText}>Add videos to library</Text>
        </Pressable>
        <Pressable style={appStyles.secondaryButton} onPress={() => setSelection(null)}><Text style={appStyles.secondaryButtonText}>Cancel</Text></Pressable>
      </View> : null}
      {progress ? <View style={[appStyles.formStatus, appStyles.formStatusInfo]}>
        <Text style={appStyles.formStatusText}>{progress.imported}/{progress.total} scanned</Text>
        {!!progress.currentFileName && <Text style={appStyles.directoryProgressFile}>{progress.currentFileName}</Text>}
      </View> : null}
      {message ? <View style={[appStyles.formStatus, appStyles.formStatusInfo]}><Text style={appStyles.formStatusText}>{message}</Text></View> : null}
      <Text style={appStyles.sectionTitle}>Scanned directories</Text>
      {channels.filter(channel => channel.id.startsWith('directory-')).map(channel => <View key={channel.id} style={appStyles.channelListCard}>
        <View style={appStyles.channelListIcon}><Ionicons name="folder-outline" size={22} color={colors.white} /></View>
        <View style={appStyles.channelListBody}><Text style={appStyles.channelListTitle}>{channel.title}</Text><Text style={appStyles.channelListMeta}>{channel.videos} videos indexed</Text></View>
      </View>)}
      {!channels.some(channel => channel.id.startsWith('directory-')) && !isLoading ? <Text style={appStyles.sectionMeta}>No directories scanned yet.</Text> : null}
    </ScrollView>
  </SafeAreaView>;
}
