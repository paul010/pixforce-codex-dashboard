import { activityDays, validCount } from './metrics.mjs';

export function parseMetricsSnapshot(text, now = new Date()) {
  if (Buffer.byteLength(text) > 32768) throw Error('统计快照过大');
  const data = JSON.parse(text);
  const capturedAt = Date.parse(data.capturedAt);
  if (data.schemaVersion !== 1 || !Number.isFinite(capturedAt) || capturedAt > now.getTime() + 30000) throw Error('统计快照格式或时间无效');
  const q = data.quota;
  const quota = q && ['5h', '7d'].includes(q.name) && validCount(q.pct) && q.pct <= 100 && Date.parse(q.resets_at) > now.getTime()
    ? { name: q.name, pct: q.pct, resets_at: q.resets_at } : null;
  const tokensTotal = Number.isSafeInteger(data.tokensTotal) && data.tokensTotal >= 0 ? data.tokensTotal : null;
  const activity = activityDays((data.activity?.days || []).map(day => ({ startDate: day.date, tokens: day.tokens })), now);
  return { quota, tokensTotal, activity, capturedAt, fresh: now.getTime() - capturedAt <= 180000 };
}
