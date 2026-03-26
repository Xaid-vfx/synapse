import axios, { AxiosError } from 'axios';
import { ENRICHMENT_CONFIG } from '../config/enrichment';

const RAPIDAPI_HOST = 'twitter283.p.rapidapi.com';
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`;

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-rapidapi-host': RAPIDAPI_HOST,
    'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
  };
}

// ---------------------------------------------------------------------------
// Token-bucket rate limiter — shared across all users
// ---------------------------------------------------------------------------
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private waitQueue: Array<{ resolve: () => void }> = [];

  constructor(
    private maxTokens: number,
    private refillRate: number,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  private refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    const waitMs = Math.ceil(((1 - this.tokens) / this.refillRate) * 1000);
    await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    return this.acquire();
  }
}

// ---------------------------------------------------------------------------
// Daily cap tracker — resets at midnight UTC
// ---------------------------------------------------------------------------
class DailyCapTracker {
  private count = 0;
  private resetDate: string;

  constructor(private cap: number) {
    this.resetDate = new Date().toISOString().split('T')[0];
  }

  private checkReset() {
    const today = new Date().toISOString().split('T')[0];
    if (today !== this.resetDate) {
      this.count = 0;
      this.resetDate = today;
    }
  }

  canProceed(): boolean {
    this.checkReset();
    return this.count < this.cap;
  }

  increment() {
    this.checkReset();
    this.count++;
  }

  remaining(): number {
    this.checkReset();
    return Math.max(0, this.cap - this.count);
  }
}

const rateLimiter = new TokenBucket(
  ENRICHMENT_CONFIG.RAPIDAPI_RATE_LIMIT_PER_SEC,
  ENRICHMENT_CONFIG.RAPIDAPI_RATE_LIMIT_PER_SEC,
);
const dailyCap = new DailyCapTracker(ENRICHMENT_CONFIG.RAPIDAPI_DAILY_CAP);

// ---------------------------------------------------------------------------
// Retry wrapper with exponential back-off + jitter
// ---------------------------------------------------------------------------
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = ENRICHMENT_CONFIG.MAX_RETRY_ATTEMPTS,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (!dailyCap.canProceed()) {
        throw new Error('RapidAPI daily cap reached — retry tomorrow');
      }
      await rateLimiter.acquire();
      dailyCap.increment();
      return await fn();
    } catch (err) {
      lastError = err as Error;
      const axiosErr = err as AxiosError;
      const status = axiosErr.response?.status;

      // 4xx (except 429 Too Many Requests) → don't retry
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }

      if (attempt < maxRetries) {
        const base = ENRICHMENT_CONFIG.RAPIDAPI_BASE_DELAY_MS;
        const factor = ENRICHMENT_CONFIG.RAPIDAPI_BACKOFF_FACTOR;
        const cap = ENRICHMENT_CONFIG.RAPIDAPI_MAX_DELAY_MS;
        const delay = Math.min(base * Math.pow(factor, attempt), cap);
        const jitter = delay * (0.5 + Math.random() * 0.5);
        console.warn(
          `[RapidAPI] Attempt ${attempt + 1} failed (${(err as Error).message}). Retrying in ${Math.round(jitter)}ms…`,
        );
        await new Promise((r) => setTimeout(r, jitter));
      }
    }
  }
  throw lastError;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------
export interface RawTweet {
  id: string;
  text: string;
  created_at: string;
  favorite_count: number;
  retweet_count: number;
  reply_count: number;
  quote_count: number;
}

// ---------------------------------------------------------------------------
// Tweet parser — handles multiple known GraphQL timeline layouts
// ---------------------------------------------------------------------------
function parseTweetsResponse(rawData: any): RawTweet[] {
  const tweets: RawTweet[] = [];

  try {
    const instructions: any[] =
      rawData?.data?.user_result?.result?.timeline_response?.timeline?.instructions ??
      rawData?.data?.user?.result?.timeline_v2?.timeline?.instructions ??
      rawData?.data?.user_result_by_rest_id?.result?.timeline_response?.timeline?.instructions ??
      [];

    for (const instruction of instructions) {
      const entries =
        instruction.entries ?? instruction.moduleItems ?? [];

      for (const entry of entries) {
        // The tweet_results location varies between API versions
        const tweetResult =
          entry?.content?.content?.tweetResult?.result ??
          entry?.content?.content?.tweet_results?.result ??
          entry?.content?.itemContent?.tweet_results?.result ??
          entry?.content?.tweet_results?.result ??
          entry?.item?.itemContent?.tweet_results?.result ??
          null;

        if (!tweetResult) continue;

        const legacy =
          tweetResult.legacy ?? tweetResult.tweet?.legacy ?? {};
        const tweetId =
          tweetResult.rest_id ?? legacy.id_str ?? '';

        if (!tweetId || (!legacy.full_text && !legacy.text)) continue;

        tweets.push({
          id: tweetId,
          text: legacy.full_text ?? legacy.text ?? '',
          created_at: legacy.created_at ?? '',
          favorite_count: legacy.favorite_count ?? 0,
          retweet_count: legacy.retweet_count ?? 0,
          reply_count: legacy.reply_count ?? 0,
          quote_count: legacy.quote_count ?? 0,
        });
      }
    }
  } catch (err) {
    console.error('[RapidAPI] Error parsing tweets response:', err);
  }

  return tweets;
}

// ---------------------------------------------------------------------------
// Public API methods
// ---------------------------------------------------------------------------

/**
 * Fetch recent tweets for a user.
 * TODO: verify exact twitter283 endpoint name & params.
 */
export async function fetchUserTweets(
  userId: string,
  count = 20,
): Promise<RawTweet[]> {
  return callWithRetry(async () => {
    const response = await axios.get(`${RAPIDAPI_BASE}/UserTweets`, {
      params: { user_id: userId, count: String(count) },
      headers: getHeaders(),
      timeout: 15_000,
    });
    return parseTweetsResponse(response.data);
  });
}

/**
 * Return current rate-limit / daily-cap health.
 */
export function getRateLimitStatus() {
  return {
    dailyRemaining: dailyCap.remaining(),
    dailyCap: ENRICHMENT_CONFIG.RAPIDAPI_DAILY_CAP,
  };
}
