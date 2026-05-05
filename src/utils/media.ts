import { Audio } from 'expo-av';
import * as VideoThumbnails from 'expo-video-thumbnails';

export function formatDuration(seconds: number | undefined) {
  if (!seconds || seconds <= 0) {
    return '0:00';
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export async function generateThumbnail(uri: string) {
  try {
    console.log('[media] generating thumbnail', { uri });
    const result = await VideoThumbnails.getThumbnailAsync(uri, {
      time: 1000,
    });
    console.log('[media] thumbnail generated', { uri, thumbnailUri: result.uri });
    return result.uri;
  } catch (error) {
    console.log('[media] thumbnail generation failed', { uri, error });
    return undefined;
  }
}

export async function extractDurationFromUri(uri: string) {
  let sound: Audio.Sound | null = null;

  try {
    console.log('[media] extracting duration', { uri });
    const created = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false },
      undefined,
      false
    );
    sound = created.sound;
    const status = await sound.getStatusAsync();

    if (status.isLoaded && typeof status.durationMillis === 'number') {
      const seconds = Math.floor(status.durationMillis / 1000);
      const formatted = formatDuration(seconds);
      console.log('[media] duration extracted', {
        uri,
        durationMillis: status.durationMillis,
        formatted,
      });
      return formatted;
    }
  } catch (error) {
    console.log('[media] duration extraction failed', { uri, error });
  } finally {
    if (sound) {
      try {
        await sound.unloadAsync();
      } catch {
        // Ignore unload failures.
      }
    }
  }

  return '0:00';
}
