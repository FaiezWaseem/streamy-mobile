import { Ionicons } from '@expo/vector-icons';
import { Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { appStyles, colors } from '../utils/theme';

export function UploadScreen() {
  const { importVideo } = useLocalLibrary();

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.pageContent}>
        <Text style={appStyles.pageTitle}>Upload</Text>
        <View style={appStyles.uploadPanel}>
          <Ionicons name="cloud-upload-outline" size={42} color={colors.accent} />
          <Text style={appStyles.uploadTitle}>Drop in a reel, clip, or full project export.</Text>
          <Text style={appStyles.uploadSubtitle}>
            Import a local video and Streamy will save it under the Imported channel so
            you can browse and play it anywhere in the app.
          </Text>
          <Pressable style={appStyles.primaryButton} onPress={importVideo}>
            <Text style={appStyles.primaryButtonText}>Choose Video</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
