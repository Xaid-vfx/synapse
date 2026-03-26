// ---------------------------------------------------------------------------
// Deterministic reputation scoring 0-100
// ---------------------------------------------------------------------------

export interface ReputationInput {
  followersCount: number;
  followingCount: number;
  ffRatio: number;
  accountAgeDays: number;
  avgLikes: number;
  avgRetweets: number;
  avgReplies: number;
  tweetFrequency30d: number;
  isVerifiedLike: boolean;
}

// Logarithmic normalization — maps large ranges into 0-1
function normLog(value: number, median: number): number {
  if (value <= 0) return 0;
  return Math.min(1, Math.log10(value + 1) / Math.log10(median + 1));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function scoreFFRatio(r: number): number {
  if (r <= 0.1) return 0.1;
  if (r <= 0.5) return 0.2;
  if (r <= 1) return 0.35;
  if (r <= 2) return 0.5;
  if (r <= 10) return 0.8;
  if (r <= 50) return 1.0;
  if (r <= 200) return 0.9;
  if (r <= 1000) return 0.7;
  return 0.5;
}

function scoreAge(days: number): number {
  if (days < 30) return 0.1;
  if (days < 90) return 0.3;
  if (days < 365) return 0.5;
  if (days < 730) return 0.7;
  if (days < 1825) return 0.9;
  return 1.0;
}

function scoreFrequency(tweetsPerMonth: number): number {
  if (tweetsPerMonth === 0) return 0;
  if (tweetsPerMonth <= 5) return 0.3;
  if (tweetsPerMonth <= 30) return 0.7;
  if (tweetsPerMonth <= 100) return 1.0;
  if (tweetsPerMonth <= 300) return 0.8;
  if (tweetsPerMonth <= 1000) return 0.5;
  return 0.2;
}

const WEIGHTS = {
  followers: 0.20,
  ffRatio: 0.15,
  accountAge: 0.15,
  tweetFrequency: 0.10,
  engagement: 0.25,
  verified: 0.15,
} as const;

export function computeReputationScore(input: ReputationInput): {
  score: number;
  breakdown: Record<string, number>;
} {
  const fScore = normLog(input.followersCount, 5000);
  const ffScore = scoreFFRatio(input.ffRatio);
  const ageScore = scoreAge(input.accountAgeDays);
  const freqScore = scoreFrequency(input.tweetFrequency30d);

  const engScore = Math.min(
    1,
    normLog(input.avgLikes, 50) * 0.5 +
      normLog(input.avgRetweets, 10) * 0.3 +
      normLog(input.avgReplies, 5) * 0.2,
  );

  const verifiedComponent = input.isVerifiedLike ? 1 : 0.5;

  const raw =
    fScore * WEIGHTS.followers +
    ffScore * WEIGHTS.ffRatio +
    ageScore * WEIGHTS.accountAge +
    freqScore * WEIGHTS.tweetFrequency +
    engScore * WEIGHTS.engagement +
    verifiedComponent * WEIGHTS.verified;

  return {
    score: Math.round(clamp(raw * 100, 0, 100)),
    breakdown: {
      followers: Math.round(fScore * 100) / 100,
      ffRatio: Math.round(ffScore * 100) / 100,
      accountAge: Math.round(ageScore * 100) / 100,
      tweetFrequency: Math.round(freqScore * 100) / 100,
      engagement: Math.round(engScore * 100) / 100,
      verified: input.isVerifiedLike ? 1 : 0,
    },
  };
}

// ---------------------------------------------------------------------------
// Activity metric derivation from raw tweet data
// ---------------------------------------------------------------------------
export function computeActivityMetrics(
  tweets: Array<{
    favorite_count: number;
    retweet_count: number;
    reply_count: number;
    created_at: string;
  }>,
) {
  if (tweets.length === 0) {
    return { tweetFrequency30d: 0, avgLikes: 0, avgRetweets: 0, avgReplies: 0 };
  }

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentCount = tweets.filter(
    (t) => new Date(t.created_at).getTime() > thirtyDaysAgo,
  ).length;

  const sum = tweets.reduce(
    (acc, t) => ({
      likes: acc.likes + t.favorite_count,
      rts: acc.rts + t.retweet_count,
      replies: acc.replies + t.reply_count,
    }),
    { likes: 0, rts: 0, replies: 0 },
  );

  const n = tweets.length;
  return {
    tweetFrequency30d: recentCount,
    avgLikes: Math.round((sum.likes / n) * 100) / 100,
    avgRetweets: Math.round((sum.rts / n) * 100) / 100,
    avgReplies: Math.round((sum.replies / n) * 100) / 100,
  };
}
