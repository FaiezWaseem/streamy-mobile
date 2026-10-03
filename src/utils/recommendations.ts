import { type VideoItem } from './types';

export type InterestWatch = { event_id: string; video_id: string; watched_at: string; tags: string[]; watched_seconds?: number; duration?: number };
export function normalizeTags(value: string | string[]): string[] {
  const tags = Array.isArray(value) ? value : value.split(/[,\n]+/);
  return Array.from(new Set(tags.map(tag => tag.trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 40)).filter(Boolean))).slice(0, 20);
}
export function newWatchId() {
  return Date.now().toString(16).padStart(12, '0') + Array.from({ length: 20 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}
export function rankVideos(videos: VideoItem[], events: InterestWatch[], reference?: VideoItem) {
  const currentTags = new Map(videos.map(video => [video.id, video.tags ?? []]));
  const history = Array.from(new Map(events.map(event => [event.event_id, event])).values())
    .sort((a, b) => Date.parse(b.watched_at) - Date.parse(a.watched_at)).slice(0, 200);
  const scores = new Map<string, number>();
  history.forEach((event, rank) => {
    const tags = currentTags.get(event.video_id) ?? event.tags;
    const ageDays = Math.max(0, (Date.now() - Date.parse(event.watched_at)) / 86400000);
    const weight = (rank < 3 ? 1.5 : 1) * Math.pow(0.5, rank / 3) * Math.pow(0.5, ageDays / 14) / Math.max(1, tags.length);
    tags.forEach(tag => scores.set(tag, (scores.get(tag) ?? 0) + weight));
  });
  const recent = new Set(history.slice(0, 3).map(event => event.video_id));
  const referenceTags = reference?.tags ?? [];
  const candidates = videos.filter(video => video.id !== reference?.id);
  const matching = referenceTags.length ? candidates.filter(video => (video.tags ?? []).some(tag => referenceTags.includes(tag))) : [];
  return (matching.length ? matching : candidates).map((video, index) => {
    const tags = video.tags ?? [];
    const interest = tags.reduce((sum, tag) => sum + (scores.get(tag) ?? 0), 0) / Math.max(1, Math.sqrt(tags.length));
    const overlap = tags.filter(tag => referenceTags.includes(tag)).length / Math.max(1, new Set([...tags, ...referenceTags]).size);
    return { video, index, score: (interest + 3 * overlap) * (recent.has(video.id) ? 0.85 : 1) };
  }).sort((a, b) => b.score - a.score || a.index - b.index).map(item => item.video);
}
