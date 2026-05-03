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

export type ScannedDirectoryRow = {
  directory_uri: string;
  title: string;
};

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion >= 3) {
    return;
  }

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
    PRAGMA user_version = 3;
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
