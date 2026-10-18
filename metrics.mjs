const DAY = 86400000;
export const validCount = (n) =>
  typeof n === "number" && Number.isFinite(n) && n >= 0;
export function compactTokens(n) {
  if (!validCount(n)) return "--";
  for (const [scale, unit] of [
    [1e12, "T"],
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ]) {
    if (n >= scale) {
      const value = n / scale;
      return `${value.toFixed(value >= 100 ? 1 : 2)}${unit}`;
    }
  }
  return String(Math.floor(n));
}
export function activityDays(buckets, now = new Date()) {
  const today = new Date(now.getTime() + 8 * 3600000)
      .toISOString()
      .slice(0, 10),
    end = Date.parse(today + "T00:00:00Z");
  const values = new Map();
  for (const b of Array.isArray(buckets) ? buckets : []) {
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(b?.startDate || "") &&
      Number.isFinite(Date.parse(b.startDate)) &&
      new Date(b.startDate).toISOString().slice(0, 10) === b.startDate &&
      validCount(b.tokens)
    )
      values.set(b.startDate, b.tokens);
  }
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = new Date(end - (13 - i) * DAY).toISOString().slice(0, 10);
    return { date, tokens: values.get(date) ?? null };
  });
  const known = days.filter((d) => d.tokens !== null);
  return {
    days,
    start: days[0].date,
    end: today,
    knownDays: known.length,
    activeDays: known.filter((d) => d.tokens > 0).length,
    total: known.length ? known.reduce((sum, d) => sum + d.tokens, 0) : null,
    peak: known.length ? Math.max(...known.map((d) => d.tokens)) : null,
  };
}
export function accountMetrics(data, now = new Date()) {
  const main = data?.rateLimitsByLimitId?.codex || data?.rateLimits;
  const windows = [main?.primary, main?.secondary].filter(
    (w) =>
      validCount(w?.usedPercent) &&
      w.usedPercent <= 100 &&
      validCount(w.resetsAt) &&
      w.resetsAt * 1000 > now.getTime(),
  );
  const w =
    windows.find((w) => w.windowDurationMins === 10080) ||
    windows.find((w) => w.windowDurationMins === 300);
  return {
    quota: w
      ? {
          name: w.windowDurationMins === 10080 ? "7d" : "5h",
          pct: w.usedPercent,
          resets_at: new Date(w.resetsAt * 1000).toISOString(),
        }
      : null,
    tokensTotal: validCount(data?.usage?.summary?.lifetimeTokens)
      ? data.usage.summary.lifetimeTokens
      : null,
    activity: activityDays(data?.usage?.dailyUsageBuckets, now),
  };
}
