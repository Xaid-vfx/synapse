import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import User from '../models/User';
import Follower from '../models/Follower';

dotenv.config();

const router = Router();

const RAPIDAPI_HOST = 'twitter283.p.rapidapi.com';
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`;
const MAX_PAGES = 100;
const PAGE_DELAY_MS = 300;
const REFRESH_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000; // 15 days

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-rapidapi-host': RAPIDAPI_HOST,
    'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
  };
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

interface RawUserResult {
  rest_id?: string;
  core?: { name?: string; screen_name?: string; created_at?: string };
  avatar?: { image_url?: string };
  profile_bio?: { description?: string };
  location?: { location?: string };
  relationship_counts?: { followers?: number; following?: number };
  tweet_counts?: { tweets?: number; media_tweets?: number };
  verification?: { is_blue_verified?: boolean; verified?: boolean };
  banner?: { image_url?: string };
}

export interface NormalizedFollower {
  id: string;
  name: string;
  screen_name: string;
  profile_image_url: string | null;
  description: string | null;
  location: string | null;
  followers_count: number;
  following_count: number;
  tweet_count: number;
  is_blue_verified: boolean;
  verified: boolean;
  banner_url: string | null;
}

function parseTimelineResponse(rawData: any): {
  followers: NormalizedFollower[];
  next_cursor: string | null;
} {
  const followers: NormalizedFollower[] = [];
  let next_cursor: string | null = null;

  try {
    const instructions: any[] =
      rawData?.data?.user_result_by_rest_id?.result?.followers_timeline?.timeline?.instructions ?? [];

    for (const instruction of instructions) {
      if (instruction.__typename !== 'TimelineAddEntries') continue;

      for (const entry of instruction.entries ?? []) {
        const content = entry?.content;

        if (content?.__typename === 'TimelineTimelineCursor' && content?.cursor_type === 'Bottom') {
          next_cursor = content.value ?? null;
          continue;
        }

        if (content?.__typename === 'TimelineTimelineItem') {
          const userResults = content?.content?.user_results;
          if (!userResults) continue;

          const u: RawUserResult = userResults.result ?? {};
          const id = (u.rest_id ?? userResults.rest_id ?? '').toString();
          if (!id) continue;

          followers.push({
            id,
            name: u.core?.name ?? 'Unknown',
            screen_name: u.core?.screen_name ?? '',
            profile_image_url: u.avatar?.image_url ?? null,
            description: u.profile_bio?.description ?? null,
            location: u.location?.location ?? null,
            followers_count: u.relationship_counts?.followers ?? 0,
            following_count: u.relationship_counts?.following ?? 0,
            tweet_count: u.tweet_counts?.tweets ?? 0,
            is_blue_verified: u.verification?.is_blue_verified ?? false,
            verified: u.verification?.verified ?? false,
            banner_url: u.banner?.image_url ?? null,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error parsing timeline response:', err);
  }

  return { followers, next_cursor };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchOnePage(endpoint: string, userId: string, cursor?: string) {
  const params: Record<string, string> = { user_id: userId };
  if (cursor) params.cursor = cursor;
  const response = await axios.get(`${RAPIDAPI_BASE}/${endpoint}`, {
    params,
    headers: getHeaders(),
  });
  return parseTimelineResponse(response.data);
}

async function saveFollowersToDB(
  userId: string,
  type: 'all' | 'verified',
  followers: NormalizedFollower[]
) {
  await Follower.deleteMany({ userId, type });

  if (followers.length === 0) return;

  const docs = followers.map((f) => ({
    userId,
    type,
    followerId: f.id,
    name: f.name,
    screen_name: f.screen_name,
    profile_image_url: f.profile_image_url,
    description: f.description,
    location: f.location,
    followers_count: f.followers_count,
    following_count: f.following_count,
    tweet_count: f.tweet_count,
    is_blue_verified: f.is_blue_verified,
    verified: f.verified,
    banner_url: f.banner_url,
    fetchedAt: new Date(),
  }));

  await Follower.insertMany(docs, { ordered: false });
}

function dbFollowerToNormalized(doc: any): NormalizedFollower {
  return {
    id: doc.followerId,
    name: doc.name,
    screen_name: doc.screen_name,
    profile_image_url: doc.profile_image_url,
    description: doc.description,
    location: doc.location,
    followers_count: doc.followers_count,
    following_count: doc.following_count,
    tweet_count: doc.tweet_count,
    is_blue_verified: doc.is_blue_verified,
    verified: doc.verified,
    banner_url: doc.banner_url,
  };
}

// SSE: stream all followers — fetches from API only if allowed, otherwise serves from DB
async function streamAllFollowers(
  endpoint: string,
  type: 'all' | 'verified',
  userId: string,
  res: Response
) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const dbUser = await User.findOne({ twitterId: userId });
  const lastFetchField = type === 'verified' ? 'lastVerifiedFetchAt' : 'lastFollowersFetchAt';
  const lastFetch = dbUser?.[lastFetchField];

  const cooldownRemaining = lastFetch
    ? REFRESH_COOLDOWN_MS - (Date.now() - new Date(lastFetch).getTime())
    : 0;

  // If within cooldown, serve from DB
  if (cooldownRemaining > 0) {
    const cached = await Follower.find({ userId, type }).lean();

    if (cached.length > 0) {
      const BATCH_SIZE = 20;
      let total = 0;
      for (let i = 0; i < cached.length; i += BATCH_SIZE) {
        const batch = cached.slice(i, i + BATCH_SIZE).map(dbFollowerToNormalized);
        total += batch.length;
        send('followers', { followers: batch, total });
      }
    }

    const nextRefreshAt = new Date(new Date(lastFetch!).getTime() + REFRESH_COOLDOWN_MS).toISOString();
    send('done', { total: cached.length, fromCache: true, nextRefreshAt });
    res.end();
    return;
  }

  // Fetch fresh from RapidAPI
  let cursor: string | undefined;
  let page = 0;
  let total = 0;
  const allFetched: NormalizedFollower[] = [];

  try {
    while (page < MAX_PAGES) {
      const { followers, next_cursor } = await fetchOnePage(endpoint, userId, cursor);

      if (followers.length > 0) {
        total += followers.length;
        allFetched.push(...followers);
        send('followers', { followers, total });
      }

      if (!next_cursor) break;
      cursor = next_cursor;
      page++;
      await sleep(PAGE_DELAY_MS);
    }

    await saveFollowersToDB(userId, type, allFetched);

    await User.updateOne(
      { twitterId: userId },
      { [lastFetchField]: new Date() }
    );

    const nextRefreshAt = new Date(Date.now() + REFRESH_COOLDOWN_MS).toISOString();
    send('done', { total, fromCache: false, nextRefreshAt });
  } catch (err: any) {
    console.error(`${endpoint} stream error:`, err.response?.data || err.message);
    send('error', { message: err.response?.data?.message || err.message });
  } finally {
    res.end();
  }
}

// Fetch single page (backward compat)
router.get('/followers', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.user!.id;
  const { cursor } = req.query;
  try {
    const parsed = await fetchOnePage('UserFollowers', userId, cursor as string | undefined);
    res.json(parsed);
  } catch (err: any) {
    res.status(err.response?.status || 500).json({ error: 'Failed to fetch followers' });
  }
});

router.get('/verified-followers', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.user!.id;
  const { cursor } = req.query;
  try {
    const parsed = await fetchOnePage('UserVerifiedFollowers', userId, cursor as string | undefined);
    res.json(parsed);
  } catch (err: any) {
    res.status(err.response?.status || 500).json({ error: 'Failed to fetch verified followers' });
  }
});

// SSE: stream ALL followers (with 15-day cooldown + DB caching)
router.get('/followers/all', requireAuth, (req: Request, res: Response) => {
  streamAllFollowers('UserFollowers', 'all', req.session.user!.id, res);
});

router.get('/verified-followers/all', requireAuth, (req: Request, res: Response) => {
  streamAllFollowers('UserVerifiedFollowers', 'verified', req.session.user!.id, res);
});

// Refresh status: lets frontend know when the next refresh is allowed
router.get('/refresh-status', requireAuth, async (req: Request, res: Response) => {
  const userId = req.session.user!.id;
  const dbUser = await User.findOne({ twitterId: userId });

  if (!dbUser) {
    return res.json({ canRefresh: true });
  }

  const lastFetch = dbUser.lastFollowersFetchAt;
  if (!lastFetch) {
    return res.json({ canRefresh: true });
  }

  const cooldownRemaining = REFRESH_COOLDOWN_MS - (Date.now() - new Date(lastFetch).getTime());

  if (cooldownRemaining <= 0) {
    return res.json({ canRefresh: true });
  }

  return res.json({
    canRefresh: false,
    nextRefreshAt: new Date(new Date(lastFetch).getTime() + REFRESH_COOLDOWN_MS).toISOString(),
    lastFetchedAt: lastFetch.toISOString(),
  });
});

export default router;
