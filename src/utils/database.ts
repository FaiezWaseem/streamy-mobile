import { type SQLiteDatabase } from 'expo-sqlite';

import { type VideoItem } from './types';

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

  await db.execAsync(`PRAGMA user_version = 4;`);
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

export async function deleteScannedDirectory(db: SQLiteDatabase, directoryUri: string) {
  const rows = await db.getAllAsync<{ video_id: string }>(
    `SELECT video_id FROM recent_videos WHERE video_id LIKE ?`,
    [`${directoryUri}:%`]
  );

  await db.runAsync(`DELETE FROM scanned_directories WHERE directory_uri = ?`, [directoryUri]);

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
