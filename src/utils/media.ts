import { File } from 'expo-file-system';
import { createVideoPlayer } from 'expo-video';
import * as VideoThumbnails from 'expo-video-thumbnails';

export function formatDuration(seconds: number | undefined) {
  if (!seconds || seconds <= 0) {
    return '0:00';
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export async function generateThumbnail(uri: string, time = 1000) {
  try {
    console.log('[media] generating thumbnail', { uri, time });
    const result = await VideoThumbnails.getThumbnailAsync(uri, {
      time,
    });
    console.log('[media] thumbnail generated', { uri, thumbnailUri: result.uri, time });
    return result.uri;
  } catch (error) {
    console.log('[media] thumbnail generation failed', { uri, time, error });
    return undefined;
  }
}

function buildCandidateOffsetsMs(durationSeconds: number | undefined) {
  if (!durationSeconds || durationSeconds <= 1) {
    return [250];
  }

  const durationMs = durationSeconds * 1000;
  return [0.1, 0.35, 0.6].map((fraction) =>
    Math.max(0, Math.min(Math.round(durationMs * fraction), durationMs - 250))
  );
}

export async function generateBestThumbnail(
  uri: string,
  durationSeconds?: number,
  candidateCount = 2
) {
  const offsets = buildCandidateOffsetsMs(durationSeconds).slice(0, Math.max(1, candidateCount));
  let best: { uri: string; size: number } | undefined;

  for (const time of offsets) {
    const candidateUri = await generateThumbnail(uri, time);

    if (!candidateUri) {
      continue;
    }

    let size = 0;
    try {
      size = new File(candidateUri).size ?? 0;
    } catch (error) {
      console.log('[media] failed to read thumbnail candidate size', { candidateUri, error });
    }

    if (!best || size > best.size) {
      best = { uri: candidateUri, size };
    }
  }

  return best?.uri;
}

export function extractDurationInfoFromUri(
  uri: string,
  timeoutMs = 8000
): Promise<{ seconds: number; formatted: string }> {
  return new Promise((resolve) => {
    let settled = false;
    let player: ReturnType<typeof createVideoPlayer> | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function finish(durationSeconds: number) {
      if (settled) {
        return;
      }
      settled = true;

      if (timer) {
        clearTimeout(timer);
      }

      try {
        player?.release();
      } catch {
        // Ignore release failures.
      }

      const seconds =
        Number.isFinite(durationSeconds) && durationSeconds > 0
          ? Math.floor(durationSeconds)
          : 0;
      const formatted = formatDuration(seconds);
      console.log('[media] duration extracted', { uri, seconds, formatted });
      resolve({ seconds, formatted });
    }

    try {
      console.log('[media] extracting duration', { uri });
      player = createVideoPlayer(uri);

      timer = setTimeout(() => finish(player?.duration ?? 0), timeoutMs);

      player.addListener('sourceLoad', (payload) => finish(payload?.duration ?? 0));
      player.addListener('statusChange', ({ status }) => {
        if (status === 'readyToPlay') {
          finish(player?.duration ?? 0);
        } else if (status === 'error') {
          finish(0);
        }
      });
    } catch (error) {
      console.log('[media] duration extraction failed', { uri, error });
      finish(0);
    }
  });
}

export async function extractDurationFromUri(uri: string) {
  const result = await extractDurationInfoFromUri(uri);
  return result.formatted;
}

function buildPreviewSegments(durationMs: number) {
  const segmentSpanMs = 3000;

  return [
    { start: 0, end: Math.min(segmentSpanMs, durationMs) },
    {
      start: durationMs * 0.25,
      end: Math.min(durationMs * 0.25 + segmentSpanMs, durationMs),
    },
    {
      start: durationMs * 0.5,
      end: Math.min(durationMs * 0.5 + segmentSpanMs, durationMs),
    },
    { start: Math.max(0, durationMs - segmentSpanMs), end: durationMs },
  ];
}

export function computePreviewTimestampsMs(durationSeconds: number, framesPerSegment = 2) {
  if (!durationSeconds || durationSeconds <= 0) {
    return [];
  }

  const durationMs = durationSeconds * 1000;
  const segments = buildPreviewSegments(durationMs);
  const timestamps: number[] = [];

  for (const segment of segments) {
    const span = Math.max(segment.end - segment.start, 0);

    for (let i = 0; i < framesPerSegment; i += 1) {
      const offset = framesPerSegment === 1 ? span / 2 : (span * i) / (framesPerSegment - 1);
      timestamps.push(Math.max(0, Math.round(Math.min(segment.start + offset, durationMs - 1))));
    }
  }

  return Array.from(new Set(timestamps)).sort((a, b) => a - b);
}

export async function generatePreviewFrames(uri: string, durationSeconds: number) {
  const timestamps = computePreviewTimestampsMs(durationSeconds, 2);
  const frames: string[] = [];

  for (const time of timestamps) {
    const thumb = await generateThumbnail(uri, time);

    if (thumb) {
      frames.push(thumb);
    }
  }

  return frames;
}
