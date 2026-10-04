import { type SQLiteDatabase } from 'expo-sqlite';

import { type VideoItem } from './types';
import { type InterestWatch } from './recommendations';

export type RecentVideoRow = {
  video_id: string;
  title: string;
  creator: string;
  thumbnail: string;
  views: string;
  duration: string;
  viewed_at: string;
  view_count: number;
};

export type ImportedVideoRow = {
  video_id: string;
  title: string;
  creator: string;
  channel_id: string;
  channel_title: string;
  video_uri: string;
  thumbnail: string | null;
  duration: string;
  views: string;
  description: string;
  subscribers: string;
  published: string;
};

export type StoredVideoRow = {
  video_id: string;
  title: string;
  creator: string;
  thumbnail: string | null;
  video_uri: string;
  duration: string;
  views: string;
  description: string;
  subscribers: string;
  published: string;
  channel_id: string | null;
  channel_title: string | null;
  tracked_at: string;
};

export type ScannedDirectoryRow = {
  directory_uri: string;
  title: string;
};

export type DirectoryVideoRow = {
  video_id: string;
  directory_uri: string;
  file_name: string;
  title: string;
  creator: string;
  channel_id: string;
  channel_title: string;
  video_uri: string;
  thumbnail: string | null;
  duration: string;
  views: string;
  description: string;
  subscribers: string;
  published: string;
  indexed_at: string;
  duration_seconds: number;
  preview_frames: string | null;
  preview_status: 'pending' | 'ready' | 'failed';
};

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 3) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS recent_videos (
        video_id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        creator TEXT NOT NULL,
        thumbnail TEXT NOT NULL,
        views TEXT NOT NULL,
        duration TEXT NOT NULL,
        viewed_at TEXT NOT NULL,
        view_count INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE IF NOT EXISTS imported_videos (
        video_id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        creator TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_title TEXT NOT NULL,
        video_uri TEXT NOT NULL,
        thumbnail TEXT,
        duration TEXT NOT NULL,
        views TEXT NOT NULL,
        description TEXT NOT NULL,
        subscribers TEXT NOT NULL,
        published TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS scanned_directories (
        directory_uri TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL
      );
    `);
  }

  if (currentVersion < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS liked_videos (
        video_id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        creator TEXT NOT NULL,
        thumbnail TEXT,
        video_uri TEXT NOT NULL,
        duration TEXT NOT NULL,
        views TEXT NOT NULL,
        description TEXT NOT NULL,
        subscribers TEXT NOT NULL,
        published TEXT NOT NULL,
        channel_id TEXT,
        channel_title TEXT,
        tracked_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS saved_videos (
        video_id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        creator TEXT NOT NULL,
        thumbnail TEXT,
        video_uri TEXT NOT NULL,
        duration TEXT NOT NULL,
        views TEXT NOT NULL,
        description TEXT NOT NULL,
        subscribers TEXT NOT NULL,
        published TEXT NOT NULL,
        channel_id TEXT,
        channel_title TEXT,
        tracked_at TEXT NOT NULL
      );
    `);
  }

  if (currentVersion < 5) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS directory_videos (
        video_id TEXT PRIMARY KEY NOT NULL,
        directory_uri TEXT NOT NULL,
        file_name TEXT NOT NULL,
        title TEXT NOT NULL,
        creator TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_title TEXT NOT NULL,
        video_uri TEXT NOT NULL,
        thumbnail TEXT,
        duration TEXT NOT NULL,
        views TEXT NOT NULL,
        description TEXT NOT NULL,
        subscribers TEXT NOT NULL,
        published TEXT NOT NULL,
        indexed_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_directory_videos_directory_uri
        ON directory_videos(directory_uri);
    `);
  }

  if (currentVersion < 6) {
    await db.execAsync(`
      ALTER TABLE directory_videos ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE directory_videos ADD COLUMN preview_frames TEXT;
      ALTER TABLE directory_videos ADD COLUMN preview_status TEXT NOT NULL DEFAULT 'pending';
      CREATE INDEX IF NOT EXISTS idx_directory_videos_preview_status
        ON directory_videos(preview_status);
    `);
  }

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS video_tags(video_id TEXT PRIMARY KEY, tags TEXT NOT NULL DEFAULT '[]');
    CREATE TABLE IF NOT EXISTS video_actor_profiles(video_id TEXT PRIMARY KEY, actors TEXT NOT NULL DEFAULT '[]');
    CREATE TABLE IF NOT EXISTS interest_watches(event_id TEXT PRIMARY KEY, video_id TEXT NOT NULL,
      watched_at TEXT NOT NULL, tags TEXT NOT NULL, watched_seconds REAL NOT NULL, duration REAL NOT NULL DEFAULT 0,
      account_key TEXT NOT NULL DEFAULT 'local', synced INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS available_tags(tag TEXT PRIMARY KEY COLLATE NOCASE);
    CREATE TABLE IF NOT EXISTS offline_downloads(video_id TEXT PRIMARY KEY, local_uri TEXT NOT NULL, video_json TEXT NOT NULL, downloaded_at TEXT NOT NULL);
    PRAGMA user_version = 8;
  `);
}

export async function recordVideoView(db: SQLiteDatabase, video: VideoItem) {
  const viewedAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO recent_videos (
      video_id, title, creator, thumbnail, views, duration, viewed_at, view_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(video_id) DO UPDATE SET
      title = excluded.title,
      creator = excluded.creator,
      thumbnail = excluded.thumbnail,
      views = excluded.views,
      duration = excluded.duration,
      viewed_at = excluded.viewed_at,
      view_count = recent_videos.view_count + 1`,
    [
      video.id,
      video.title,
      video.creator,
      video.image ?? '',
      video.views,
      video.duration,
      viewedAt,
    ]
  );
}

export async function getRecentVideos(db: SQLiteDatabase, limit = 5) {
  return db.getAllAsync<RecentVideoRow>(
    `SELECT * FROM recent_videos ORDER BY datetime(viewed_at) DESC LIMIT ?`,
    [limit]
  );
}

export async function saveImportedVideo(
  db: SQLiteDatabase,
  video: ImportedVideoRow
) {
  await db.runAsync(
    `INSERT OR REPLACE INTO imported_videos (
      video_id, title, creator, channel_id, channel_title, video_uri, thumbnail,
      duration, views, description, subscribers, published
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      video.video_id,
      video.title,
      video.creator,
      video.channel_id,
      video.channel_title,
      video.video_uri,
      video.thumbnail ?? null,
      video.duration,
      video.views,
      video.description,
      video.subscribers,
      video.published,
    ]
  );
}

export async function getImportedVideos(db: SQLiteDatabase) {
  return db.getAllAsync<ImportedVideoRow>(
    `SELECT * FROM imported_videos ORDER BY rowid DESC`
  );
}

export async function deleteImportedVideo(db: SQLiteDatabase, videoId: string) {
  await db.runAsync(`DELETE FROM imported_videos WHERE video_id = ?`, [videoId]);
  await deleteVideoReferences(db, videoId);
}

export async function deleteImportedVideosByChannel(
  db: SQLiteDatabase,
  channelId: string
) {
  const rows = await db.getAllAsync<{ video_id: string }>(
    `SELECT video_id FROM imported_videos WHERE channel_id = ?`,
    [channelId]
  );

  await db.runAsync(`DELETE FROM imported_videos WHERE channel_id = ?`, [channelId]);

  for (const row of rows) {
    await deleteVideoReferences(db, row.video_id);
  }
}

export async function saveScannedDirectory(
  db: SQLiteDatabase,
  directory: ScannedDirectoryRow
) {
  await db.runAsync(
    `INSERT OR REPLACE INTO scanned_directories (directory_uri, title) VALUES (?, ?)`,
    [directory.directory_uri, directory.title]
  );
}

export async function getScannedDirectories(db: SQLiteDatabase) {
  return db.getAllAsync<ScannedDirectoryRow>(
    `SELECT * FROM scanned_directories ORDER BY rowid DESC`
  );
}

const DIRECTORY_VIDEO_COLUMNS = `
  video_id, directory_uri, file_name, title, creator, channel_id,
  channel_title, video_uri, thumbnail, duration, views, description,
  subscribers, published, indexed_at, duration_seconds, preview_frames, preview_status
`;

function directoryVideoParams(video: DirectoryVideoRow) {
  return [
    video.video_id,
    video.directory_uri,
    video.file_name,
    video.title,
    video.creator,
    video.channel_id,
    video.channel_title,
    video.video_uri,
    video.thumbnail,
    video.duration,
    video.views,
    video.description,
    video.subscribers,
    video.published,
    video.indexed_at,
    video.duration_seconds,
    video.preview_frames,
    video.preview_status,
  ];
}

export async function saveDirectoryVideos(
  db: SQLiteDatabase,
  directoryUri: string,
  videos: DirectoryVideoRow[]
) {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(`DELETE FROM directory_videos WHERE directory_uri = ?`, [
      directoryUri,
    ]);

    for (const video of videos) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO directory_videos (${DIRECTORY_VIDEO_COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        directoryVideoParams(video)
      );
    }
  });
}

export async function upsertDirectoryVideos(db: SQLiteDatabase, videos: DirectoryVideoRow[]) {
  if (!videos.length) {
    return;
  }

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const video of videos) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO directory_videos (${DIRECTORY_VIDEO_COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        directoryVideoParams(video)
      );
    }
  });
}

export async function pruneDirectoryVideos(
  db: SQLiteDatabase,
  directoryUri: string,
  keepVideoIds: string[]
) {
  if (!keepVideoIds.length) {
    await db.runAsync(`DELETE FROM directory_videos WHERE directory_uri = ?`, [directoryUri]);
    return;
  }

  const placeholders = keepVideoIds.map(() => '?').join(',');
  await db.runAsync(
    `DELETE FROM directory_videos WHERE directory_uri = ? AND video_id NOT IN (${placeholders})`,
    [directoryUri, ...keepVideoIds]
  );
}

export async function getDirectoryVideos(db: SQLiteDatabase) {
  return db.getAllAsync<DirectoryVideoRow>(
    `SELECT * FROM directory_videos ORDER BY datetime(indexed_at) DESC, rowid DESC`
  );
}

export async function getPendingPreviewVideos(db: SQLiteDatabase, limit = 6) {
  return db.getAllAsync<DirectoryVideoRow>(
    `SELECT * FROM directory_videos WHERE preview_status = 'pending' ORDER BY rowid DESC LIMIT ?`,
    [limit]
  );
}

export async function savePreviewFrames(
  db: SQLiteDatabase,
  videoId: string,
  frameUris: string[] | null,
  status: 'ready' | 'failed'
) {
  await db.runAsync(
    `UPDATE directory_videos SET preview_frames = ?, preview_status = ? WHERE video_id = ?`,
    [frameUris ? JSON.stringify(frameUris) : null, status, videoId]
  );
}

export async function deleteScannedDirectory(db: SQLiteDatabase, directoryUri: string) {
  const rows = await db.getAllAsync<{ video_id: string }>(
    `SELECT video_id FROM directory_videos WHERE directory_uri = ?
     UNION
     SELECT video_id FROM recent_videos WHERE video_id LIKE ?`,
    [directoryUri, `${directoryUri}:%`]
  );

  await db.runAsync(`DELETE FROM scanned_directories WHERE directory_uri = ?`, [directoryUri]);
  await db.runAsync(`DELETE FROM directory_videos WHERE directory_uri = ?`, [directoryUri]);

  for (const row of rows) {
    await deleteVideoReferences(db, row.video_id);
  }
}

async function ensureTrackedTables(db: SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS liked_videos (
      video_id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      creator TEXT NOT NULL,
      thumbnail TEXT,
      video_uri TEXT NOT NULL,
      duration TEXT NOT NULL,
      views TEXT NOT NULL,
      description TEXT NOT NULL,
      subscribers TEXT NOT NULL,
      published TEXT NOT NULL,
      channel_id TEXT,
      channel_title TEXT,
      tracked_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS saved_videos (
      video_id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      creator TEXT NOT NULL,
      thumbnail TEXT,
      video_uri TEXT NOT NULL,
      duration TEXT NOT NULL,
      views TEXT NOT NULL,
      description TEXT NOT NULL,
      subscribers TEXT NOT NULL,
      published TEXT NOT NULL,
      channel_id TEXT,
      channel_title TEXT,
      tracked_at TEXT NOT NULL
    );
  `);
}

async function deleteVideoReferences(db: SQLiteDatabase, videoId: string) {
  await ensureTrackedTables(db);
  await db.runAsync(`DELETE FROM recent_videos WHERE video_id = ?`, [videoId]);
  await db.runAsync(`DELETE FROM liked_videos WHERE video_id = ?`, [videoId]);
  await db.runAsync(`DELETE FROM saved_videos WHERE video_id = ?`, [videoId]);
}

async function upsertTrackedVideo(
  db: SQLiteDatabase,
  table: 'liked_videos' | 'saved_videos',
  video: VideoItem
) {
  await ensureTrackedTables(db);
  await db.runAsync(
    `INSERT OR REPLACE INTO ${table} (
      video_id, title, creator, thumbnail, video_uri, duration, views,
      description, subscribers, published, channel_id, channel_title, tracked_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      video.id,
      video.title,
      video.creator,
      video.image ?? null,
      video.video,
      video.duration,
      video.views,
      video.description,
      video.subscribers,
      video.published,
      video.channelId ?? null,
      video.channelTitle ?? null,
      new Date().toISOString(),
    ]
  );
}

async function removeTrackedVideo(
  db: SQLiteDatabase,
  table: 'liked_videos' | 'saved_videos',
  videoId: string
) {
  await ensureTrackedTables(db);
  await db.runAsync(`DELETE FROM ${table} WHERE video_id = ?`, [videoId]);
}

async function hasTrackedVideo(
  db: SQLiteDatabase,
  table: 'liked_videos' | 'saved_videos',
  videoId: string
) {
  await ensureTrackedTables(db);
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM ${table} WHERE video_id = ?`,
    [videoId]
  );

  return (row?.count ?? 0) > 0;
}

async function getTrackedVideos(
  db: SQLiteDatabase,
  table: 'liked_videos' | 'saved_videos'
) {
  await ensureTrackedTables(db);
  return db.getAllAsync<StoredVideoRow>(
    `SELECT * FROM ${table} ORDER BY datetime(tracked_at) DESC`
  );
}

export async function likeVideo(db: SQLiteDatabase, video: VideoItem) {
  return upsertTrackedVideo(db, 'liked_videos', video);
}

export async function unlikeVideo(db: SQLiteDatabase, videoId: string) {
  return removeTrackedVideo(db, 'liked_videos', videoId);
}

export async function isVideoLiked(db: SQLiteDatabase, videoId: string) {
  return hasTrackedVideo(db, 'liked_videos', videoId);
}

export async function getLikedVideos(db: SQLiteDatabase) {
  return getTrackedVideos(db, 'liked_videos');
}

export async function saveVideo(db: SQLiteDatabase, video: VideoItem) {
  return upsertTrackedVideo(db, 'saved_videos', video);
}

export async function unsaveVideo(db: SQLiteDatabase, videoId: string) {
  return removeTrackedVideo(db, 'saved_videos', videoId);
}

export async function isVideoSaved(db: SQLiteDatabase, videoId: string) {
  return hasTrackedVideo(db, 'saved_videos', videoId);
}

export async function getSavedVideos(db: SQLiteDatabase) {
  return getTrackedVideos(db, 'saved_videos');
}

export async function setVideoTags(db: SQLiteDatabase, videoId: string, tags: string[]) {
  await db.runAsync('INSERT INTO video_tags(video_id,tags) VALUES(?,?) ON CONFLICT(video_id) DO UPDATE SET tags=excluded.tags', [videoId, JSON.stringify(tags)]);
}
export async function getLocalVideoTags(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{ video_id: string; tags: string }>('SELECT * FROM video_tags');
  return Object.fromEntries(rows.map(row => [row.video_id, JSON.parse(row.tags) as string[]]));
}
export async function setLocalVideoActors(db: SQLiteDatabase, videoId: string, actors: import('./types').ActorItem[]) {
  await db.runAsync('INSERT INTO video_actor_profiles(video_id,actors) VALUES(?,?) ON CONFLICT(video_id) DO UPDATE SET actors=excluded.actors', [videoId, JSON.stringify(actors)]);
}
export async function getLocalVideoActors(db: SQLiteDatabase) {
  const rows=await db.getAllAsync<{video_id:string;actors:string}>('SELECT * FROM video_actor_profiles');
  return Object.fromEntries(rows.map(row=>[row.video_id,JSON.parse(row.actors) as import('./types').ActorItem[]]));
}
export async function recordInterestEvent(db: SQLiteDatabase, event: InterestWatch, seconds: number, accountKey = 'local') {
  await db.runAsync('INSERT OR IGNORE INTO interest_watches(event_id,video_id,watched_at,tags,watched_seconds,account_key,duration) VALUES(?,?,?,?,?,?,?)',
    [event.event_id, event.video_id, event.watched_at, JSON.stringify(event.tags), seconds, accountKey, event.duration ?? 0]);
}
export async function getInterestHistory(db: SQLiteDatabase, accountKey: string | null) {
  const rows = await db.getAllAsync<Omit<InterestWatch, 'tags'> & { tags: string }>(
    'SELECT * FROM interest_watches WHERE account_key=\'local\' OR account_key=? ORDER BY watched_at DESC,rowid DESC LIMIT 200', [accountKey ?? '']);
  return rows.map(row => ({ ...row, tags: JSON.parse(row.tags) as string[] }));
}
export async function pendingInterestEvents(db: SQLiteDatabase, accountKey: string) {
  const rows = await db.getAllAsync<Omit<InterestWatch, 'tags'> & { tags: string }>("SELECT * FROM interest_watches WHERE (account_key=? OR account_key='local') AND synced=0 ORDER BY watched_at LIMIT 20", [accountKey]);
  return rows.map(row => ({ ...row, tags: JSON.parse(row.tags) as string[] }));
}
export async function markInterestSynced(db: SQLiteDatabase, eventId: string) {
  await db.runAsync('UPDATE interest_watches SET synced=1 WHERE event_id=?', [eventId]);
}

export async function getAvailableTags(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<{tag: string}>('SELECT tag FROM available_tags ORDER BY tag COLLATE NOCASE');
  return rows.map(row => row.tag);
}
export async function addAvailableTags(db: SQLiteDatabase, tags: string[]) {
  for (const tag of tags) await db.runAsync('INSERT OR IGNORE INTO available_tags(tag) VALUES(?)', [tag]);
}
export async function removeAvailableTag(db: SQLiteDatabase, tag: string) {
  await db.runAsync('DELETE FROM available_tags WHERE tag=?', [tag]);
}
export type OfflineDownloadRow = { video_id: string; local_uri: string; video_json: string };
export async function getOfflineDownloads(db: SQLiteDatabase) {
  return db.getAllAsync<OfflineDownloadRow>('SELECT video_id,local_uri,video_json FROM offline_downloads');
}
export async function saveOfflineDownload(db: SQLiteDatabase, video: VideoItem, uri: string) {
  const { authToken, ...metadata } = video;
  await db.runAsync('INSERT INTO offline_downloads(video_id,local_uri,video_json,downloaded_at) VALUES(?,?,?,?) ON CONFLICT(video_id) DO UPDATE SET local_uri=excluded.local_uri,video_json=excluded.video_json,downloaded_at=excluded.downloaded_at',
    [video.id, uri, JSON.stringify(metadata), new Date().toISOString()]);
}
export async function deleteOfflineDownload(db: SQLiteDatabase, videoId: string) {
  await db.runAsync('DELETE FROM offline_downloads WHERE video_id=?', [videoId]);
}
