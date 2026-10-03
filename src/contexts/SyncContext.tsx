import { useSQLiteContext } from 'expo-sqlite';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useServerLibrary } from './ServerLibraryContext';
import { isLocalMediaUri } from '../utils/localFiles';
import { newWatchId } from '../utils/recommendations';
import { type VideoItem } from '../utils/types';

export type SyncJob = {
  id: string; accountKey: string; video: VideoItem;
  status: 'queued' | 'uploading' | 'synced' | 'failed' | 'interrupted';
  sent: number; total: number; serverId?: string; error?: string; updatedAt: number;
};
type Progress = (sent: number, total: number) => void;
type Value = {
  jobs: SyncJob[]; ready: boolean; storageError: string | null;
  queueVideos: (videos: VideoItem[]) => Promise<number>;
  retry: (id: string) => Promise<void>;
  upload: (video: VideoItem, progress?: Progress) => Promise<string>;
};
const Context = createContext<Value | null>(null);
export function SyncProvider({ children }: { children: ReactNode }) {
  const db = useSQLiteContext();
  const server = useServerLibrary();
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const rows = useRef<SyncJob[]>([]);
  const running = useRef(false);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const enqueues = useRef<Promise<unknown>>(Promise.resolve());
  const waits = useRef(new Map<string, { promise: Promise<string>; resolve: (id: string) => void; reject: (error: Error) => void; progress: Progress[] }>());

  const save = useCallback((job: SyncJob) => {
    const json = JSON.stringify(job);
    const operation = writes.current.catch(() => undefined).then(() => db.runAsync(
      'INSERT INTO sync_jobs(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data', [job.id, json]));
    writes.current = operation;
    return operation;
  }, [db]);
  const publish = useCallback((job: SyncJob) => {
    rows.current = [job, ...rows.current.filter(row => row.id !== job.id)];
    setJobs([...rows.current]);
  }, []);
  useEffect(() => {
    let active = true;
    (async () => {
      await db.execAsync('CREATE TABLE IF NOT EXISTS sync_jobs(id TEXT PRIMARY KEY,data TEXT NOT NULL)');
      const stored = await db.getAllAsync<{ data: string }>('SELECT data FROM sync_jobs');
      const loaded = stored.map(row => JSON.parse(row.data) as SyncJob).map(job =>
        job.status === 'uploading' || job.status === 'queued'
          ? { ...job, status: 'interrupted' as const, error: 'Upload interrupted. Tap Retry to restart safely.' } : job);
      for (const job of loaded) await save(job);
      if (active) { rows.current = loaded; setJobs(loaded); setReady(true); }
    })().catch(() => { if (active) setStorageError('Could not load sync history. Restart the app before uploading.'); });
    return () => { active = false; };
  }, [db, save]);

  // The provider stays mounted while the user moves between screens.
  useEffect(() => {
    if (!ready || running.current || !server.accountKey || !server.connected) return;
    const job = [...rows.current].reverse().find(row => row.status === 'queued' && row.accountKey === server.accountKey);
    if (!job) return;
    running.current = true;
    let current: SyncJob = { ...job, status: 'uploading' as SyncJob['status'], error: undefined, sent: 0 };
    publish(current);
    (async () => {
      await save(current);
      const serverId = await server.upload(current.video, (sent, total) => {
        current = { ...current, sent, total, updatedAt: Date.now() };
        publish(current);
        void save(current).catch(() => setStorageError('Sync history could not be saved.'));
        waits.current.get(job.id)?.progress.forEach(callback => callback(sent, total));
      }, job.id);
      current = { ...current, status: 'synced', sent: current.total, serverId, error: undefined, updatedAt: Date.now() };
      // A storage or library refresh error must never turn a verified upload into a failed transfer.
      await save(current).catch(() => setStorageError('Uploaded successfully, but sync history could not be saved.'));
      publish(current);
      waits.current.get(job.id)?.resolve(serverId);
    })().catch(async cause => {
      const error = cause instanceof Error ? cause : new Error('Upload failed. Your local file was kept.');
      current = { ...current, status: 'failed', error: error.message, updatedAt: Date.now() };
      await save(current).catch(() => setStorageError('Sync history could not be saved.'));
      publish(current);
      waits.current.get(job.id)?.reject(error);
    }).finally(() => {
      waits.current.delete(job.id);
      running.current = false;
      setJobs([...rows.current]);
    });
  }, [jobs, ready, server.accountKey, server.connected, server.upload, publish, save]);

  const enqueue = useCallback((videos: VideoItem[]) => {
    const accountKey = server.accountKey;
    const operation = enqueues.current.catch(() => undefined).then(async () => {
      if (!ready) throw new Error('Sync history is still loading.');
      if (!server.connected || !accountKey) throw new Error('Connect to your server in Profile first.');
      const result: SyncJob[] = [];
      for (const video of videos) {
        if (!isLocalMediaUri(video.video)) continue;
        const existing = rows.current.find(row => row.accountKey === accountKey && row.video.id === video.id && row.video.video === video.video);
        if (existing && ['queued', 'uploading', 'synced'].includes(existing.status)) { result.push(existing); continue; }
        const { authToken, ...metadata } = video;
        const job: SyncJob = { id: existing?.id ?? newWatchId(), accountKey, video: metadata,
          status: 'queued', sent: 0, total: existing?.total ?? 0, updatedAt: Date.now() };
        await save(job);
        publish(job);
        result.push(job);
      }
      return result;
    });
    enqueues.current = operation;
    return operation;
  }, [ready, server.connected, server.accountKey, save, publish]);
  const queueVideos = useCallback(async (videos: VideoItem[]) => {
    const already = new Set(rows.current.filter(job => ['queued', 'uploading', 'synced'].includes(job.status) && job.accountKey === server.accountKey).map(job => job.id));
    const queued = await enqueue(videos);
    return queued.filter(job => !already.has(job.id)).length;
  }, [enqueue, server.accountKey]);
  const retry = useCallback(async (id: string) => {
    const job = rows.current.find(row => row.id === id);
    if (job && job.accountKey === server.accountKey) await enqueue([job.video]);
  }, [enqueue, server.accountKey]);
  const upload = useCallback(async (video: VideoItem, progress?: Progress) => {
    const [queued] = await enqueue([video]);
    if (!queued) throw new Error('Only device videos can be synced.');
    const job = rows.current.find(row => row.id === queued.id)!;
    if (job.status === 'synced' && job.serverId) { progress?.(job.total, job.total); return job.serverId; }
    if (job.status === 'failed') throw new Error(job.error);
    let waiter = waits.current.get(job.id);
    if (!waiter) {
      let resolve!: (id: string) => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
      waiter = { promise, resolve, reject, progress: [] };
      waits.current.set(job.id, waiter);
    }
    if (progress) { waiter.progress.push(progress); progress(job.sent, job.total || 1); }
    return waiter.promise;
  }, [enqueue]);
  const value = useMemo(() => ({ jobs: jobs.filter(job => job.accountKey === server.accountKey), ready, storageError, queueVideos, retry, upload }),
    [jobs, server.accountKey, ready, storageError, queueVideos, retry, upload]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSync() {
  const value = useContext(Context);
  if (!value) throw new Error('useSync must be used within SyncProvider');
  return value;
}
