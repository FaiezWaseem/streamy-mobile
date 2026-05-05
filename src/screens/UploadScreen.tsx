import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useLocalLibrary } from '../contexts/LocalLibraryContext';
import { saveImportedVideo } from '../utils/database';
import { extractDurationFromUri, generateThumbnail } from '../utils/media';
import { appStyles, colors } from '../utils/theme';

export function UploadScreen() {
  const db = useSQLiteContext();
  const { refreshLibrary } = useLocalLibrary();
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [duration, setDuration] = useState('0:00');
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('');
  const [description, setDescription] = useState('');
  const [isPendingConfirmation, setIsPendingConfirmation] = useState(false);
  const [isPicking, setIsPicking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    video?: string;
    title?: string;
    channel?: string;
    description?: string;
  }>({});

  function slugifyChannelId(value: string) {
    return `channel-${value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')}`;
  }

  async function handleChooseVideo() {
    setIsPicking(true);
    setStatusMessage(null);
    setErrors((current) => ({ ...current, video: undefined }));

    try {
      console.log('[upload] opening document picker');
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets[0]) {
        console.log('[upload] document picker cancelled');
        return;
      }

      const asset = result.assets[0];
      console.log('[upload] video selected', { name: asset.name, uri: asset.uri });
      setVideoUri(asset.uri);
      const baseName = asset.name.replace(/\.[^/.]+$/, '') || 'Imported video';
      setTitle(baseName);
      if (!channel.trim()) {
        setChannel('Imported');
      }

      const thumb = await generateThumbnail(asset.uri);
      const extractedDuration = await extractDurationFromUri(asset.uri);
      setThumbnailUri(thumb ?? null);
      setDuration(extractedDuration);
      setIsPendingConfirmation(true);
      console.log('[upload] metadata prepared', {
        thumbnailUri: thumb,
        duration: extractedDuration,
      });
    } finally {
      setIsPicking(false);
    }
  }

  function validate() {
    const nextErrors: {
      video?: string;
      title?: string;
      channel?: string;
      description?: string;
    } = {};

    if (!videoUri) {
      nextErrors.video = 'Please choose a video first';
    }
    if (!title.trim()) {
      nextErrors.title = 'Title is required';
    }
    if (!channel.trim()) {
      nextErrors.channel = 'Category / channel is required';
    }
    if (!description.trim()) {
      nextErrors.description = 'Description is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSaveVideo() {
    if (!validate() || !videoUri) {
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      console.log('[upload] saving video to sqlite', {
        title: title.trim(),
        channel: channel.trim(),
        videoUri,
        thumbnailUri,
        duration,
      });
      await saveImportedVideo(db, {
        video_id: `imported-${Date.now()}`,
        title: title.trim(),
        creator: channel.trim(),
        channel_id: slugifyChannelId(channel),
        channel_title: channel.trim(),
        video_uri: videoUri,
        thumbnail: thumbnailUri,
        duration,
        views: 'Imported file',
        description: description.trim(),
        subscribers: 'Private import',
        published: 'Just now',
      });

      await refreshLibrary();
      console.log('[upload] video saved and library refreshed');
      setStatusMessage('Video saved successfully with thumbnail, title, category, and description.');
      setVideoUri(null);
      setThumbnailUri(null);
      setDuration('0:00');
      setTitle('');
      setChannel('');
      setDescription('');
      setIsPendingConfirmation(false);
      setErrors({});
    } finally {
      setIsSaving(false);
    }
  }

  function handleResetSelection() {
    console.log('[upload] clearing pending selection');
    setVideoUri(null);
    setThumbnailUri(null);
    setDuration('0:00');
    setTitle('');
    setChannel('');
    setDescription('');
    setIsPendingConfirmation(false);
    setErrors({});
    setStatusMessage(null);
  }

  return (
    <SafeAreaView style={appStyles.screen}>
      <ScrollView contentContainerStyle={appStyles.pageContent}>
        <Text style={appStyles.pageTitle}>Upload</Text>
        <View style={appStyles.uploadPanel}>
          <Ionicons name="cloud-upload-outline" size={42} color={colors.accent} />
          <Text style={appStyles.uploadTitle}>Drop in a reel, clip, or full project export.</Text>
          <Text style={appStyles.uploadSubtitle}>
            Choose a local video, review the thumbnail, then set the channel, title,
            and description before saving everything into SQLite.
          </Text>
          <Pressable style={appStyles.primaryButton} onPress={handleChooseVideo} disabled={isPicking}>
            <Text style={appStyles.primaryButtonText}>
              {isPicking ? 'Choosing Video...' : 'Choose Video'}
            </Text>
          </Pressable>
          {errors.video ? <Text style={appStyles.inputErrorText}>{errors.video}</Text> : null}

          {videoUri ? (
            <View style={appStyles.uploadPreviewCard}>
              {thumbnailUri ? (
                <Image source={{ uri: thumbnailUri }} style={appStyles.uploadPreviewImage} />
              ) : (
                <View style={appStyles.uploadPreviewPlaceholder}>
                  <Text style={appStyles.videoCardPlaceholderText}>No thumbnail yet</Text>
                </View>
              )}
              <Text style={appStyles.uploadPreviewLabel}>Thumbnail Preview</Text>
              <Text style={appStyles.uploadPreviewMeta}>Duration: {duration}</Text>
              <View style={[appStyles.formStatus, appStyles.formStatusInfo]}>
                <Text style={appStyles.formStatusText}>
                  Video selected only. It is not saved yet. Review the details below and tap
                  `Confirm & Save Video` when ready.
                </Text>
              </View>
            </View>
          ) : null}

          <View style={appStyles.inputGroup}>
            <Text style={appStyles.inputLabel}>Category / Channel</Text>
            <TextInput
              value={channel}
              onChangeText={setChannel}
              placeholder="Downloads, Tutorials, Client Work"
              placeholderTextColor={colors.textMuted}
              style={[appStyles.input, errors.channel ? appStyles.inputError : null]}
            />
            {errors.channel ? <Text style={appStyles.inputErrorText}>{errors.channel}</Text> : null}
          </View>

          <View style={appStyles.inputGroup}>
            <Text style={appStyles.inputLabel}>Video Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Enter a title"
              placeholderTextColor={colors.textMuted}
              style={[appStyles.input, errors.title ? appStyles.inputError : null]}
            />
            {errors.title ? <Text style={appStyles.inputErrorText}>{errors.title}</Text> : null}
          </View>

          <View style={appStyles.inputGroup}>
            <Text style={appStyles.inputLabel}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Add a description for this video"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              style={[
                appStyles.input,
                appStyles.textArea,
                errors.description ? appStyles.inputError : null,
              ]}
            />
            {errors.description ? (
              <Text style={appStyles.inputErrorText}>{errors.description}</Text>
            ) : null}
          </View>

          <Pressable
            style={[appStyles.primaryButton, isSaving ? appStyles.primaryButtonDisabled : null]}
            onPress={handleSaveVideo}
            disabled={isSaving || !isPendingConfirmation}
          >
            {isSaving ? (
              <View style={appStyles.primaryButtonLoadingRow}>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={appStyles.primaryButtonText}>Saving...</Text>
              </View>
            ) : (
              <Text style={appStyles.primaryButtonText}>Confirm & Save Video</Text>
            )}
          </Pressable>

          {isPendingConfirmation ? (
            <Pressable style={appStyles.secondaryButton} onPress={handleResetSelection}>
              <Text style={appStyles.secondaryButtonText}>Cancel Selection</Text>
            </Pressable>
          ) : null}

          {statusMessage ? (
            <View style={[appStyles.formStatus, appStyles.formStatusSuccess]}>
              <Text style={appStyles.formStatusText}>{statusMessage}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
