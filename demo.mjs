// Deliberately synthetic data for screenshots, tests and screen recording.
export function demoAccountData(now = new Date()) {
  const today = new Date(now.getTime() + 8 * 3600000)
      .toISOString()
      .slice(0, 10),
    end = Date.parse(today + "T00:00:00Z");
  const amounts = [
    12000000, 23000000, 0, 16500000, 24000000, 31000000, 9000000, 42000000,
    14000000, 18000000, 8000000, 29000000, 21000000,
  ];
  return {
    rateLimits: {
      primary: {
        usedPercent: 37,
        windowDurationMins: 10080,
        resetsAt: Math.floor(now.getTime() / 1000) + 3 * 86400,
      },
    },
    usage: {
      summary: { lifetimeTokens: 1234567890 },
      dailyUsageBuckets: amounts.map((tokens, i) => ({
        startDate: new Date(end - (13 - i) * 86400000)
          .toISOString()
          .slice(0, 10),
        tokens,
      })),
    },
  };
}
