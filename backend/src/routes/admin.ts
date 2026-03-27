import { Router, Request, Response } from 'express';
import axios from 'axios';
import { TwitterApi } from 'twitter-api-v2';
import AccessGrant from '../models/AccessGrant';
import User from '../models/User';
import Follower from '../models/Follower';
import { requireAdminSession } from '../middleware/access';
import { triggerEnrichment } from '../services/enrichmentService';

const router = Router();
const RAPIDAPI_HOST = 'twitter283.p.rapidapi.com';
const RAPIDAPI_BASE = `https://${RAPIDAPI_HOST}`;
const PAGE_DELAY_MS = 300;

interface NormalizedFollower {
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
  created_at: string | null;
}

function getRapidHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-rapidapi-host': RAPIDAPI_HOST,
    'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
  };
}

function getTwitterClient() {
  return new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID!,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
  });
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

          const u = userResults.result ?? {};
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
            created_at: u.core?.created_at ?? null,
          });
        }
      }
    }
  } catch (err) {
    console.error('Error parsing timeline response:', err);
  }

  return { followers, next_cursor };
}

async function fetchFollowersPage(userId: string, cursor?: string) {
  const params: Record<string, string> = { user_id: userId };
  if (cursor) params.cursor = cursor;
  const response = await axios.get(`${RAPIDAPI_BASE}/UserFollowers`, {
    params,
    headers: getRapidHeaders(),
  });
  return parseTimelineResponse(response.data);
}

async function fetchAllFollowers(userId: string): Promise<NormalizedFollower[]> {
  const allFollowers: NormalizedFollower[] = [];
  let cursor: string | undefined;

  while (true) {
    const { followers, next_cursor } = await fetchFollowersPage(userId, cursor);
    if (followers.length > 0) {
      allFollowers.push(...followers);
    }
    if (!next_cursor) break;
    cursor = next_cursor;
    await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS));
  }

  return allFollowers;
}

async function saveFollowersToDB(userId: string, followers: NormalizedFollower[]) {
  const fetchedAt = new Date();
  const followerIds = followers.map((f) => f.id);

  if (followerIds.length === 0) {
    await Follower.deleteMany({ userId, type: 'all' });
    await User.updateOne({ twitterId: userId }, { lastFollowersFetchAt: new Date() });
    return;
  }

  await Follower.deleteMany({ userId, type: 'all', followerId: { $nin: followerIds } });

  await Follower.bulkWrite(
    followers.map((f) => ({
      updateOne: {
        filter: { userId, type: 'all', followerId: f.id },
        update: {
          $set: {
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
            created_at: f.created_at,
            fetchedAt,
            // Force re-enrichment for this one-shot admin backfill run.
            'enrichment.status': 'pending',
            'enrichment.lastError': null,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false }
  );

  await User.updateOne({ twitterId: userId }, { lastFollowersFetchAt: new Date() });
}

router.get('/admin/status', (req: Request, res: Response) => {
  res.json({ authenticated: Boolean(req.session.adminAuthenticated) });
});

router.post('/admin/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const envUser = process.env.ADMIN_USERNAME;
  const envPassword = process.env.ADMIN_PASSWORD;
  if (!envUser || !envPassword) {
    return res.status(500).json({ error: 'Admin credentials are not configured' });
  }

  if (username !== envUser || password !== envPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.adminAuthenticated = true;
  return res.json({ success: true });
});

router.post('/admin/logout', (req: Request, res: Response) => {
  req.session.adminAuthenticated = false;
  return res.json({ success: true });
});

router.get('/admin/whitelist', requireAdminSession, async (_req: Request, res: Response) => {
  const items = await AccessGrant.find({ active: true }).sort({ createdAt: -1 }).lean();
  return res.json({
    usernames: items.map((item) => item.username),
  });
});

router.post('/admin/whitelist', requireAdminSession, async (req: Request, res: Response) => {
  const username = String(req.body?.username || '').trim().replace(/^@/, '');
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }
  const usernameLower = username.toLowerCase();

  await AccessGrant.findOneAndUpdate(
    { usernameLower },
    { username, usernameLower, active: true },
    { upsert: true, new: true }
  );

  return res.json({ success: true, username });
});

router.delete('/admin/whitelist/:username', requireAdminSession, async (req: Request, res: Response) => {
  const username = String(req.params.username || '').trim().replace(/^@/, '').toLowerCase();
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }
  await AccessGrant.deleteOne({ usernameLower: username });
  return res.json({ success: true });
});

router.post('/admin/backfill-whitelist', requireAdminSession, async (req: Request, res: Response) => {
  const username = String(req.body?.username || '').trim().replace(/^@/, '');
  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  const usernameLower = username.toLowerCase();

  try {
    const appClient = await getTwitterClient().appLogin();
    const userResp = await appClient.v2.userByUsername(username, {
      'user.fields': ['profile_image_url', 'public_metrics', 'description'],
    });
    const user = userResp.data;

    if (!user?.id) {
      return res.status(404).json({ error: 'Twitter username not found' });
    }

    await User.findOneAndUpdate(
      { twitterId: user.id },
      {
        twitterId: user.id,
        name: user.name,
        username: user.username,
        profileImageUrl: user.profile_image_url,
        description: (user as any).description,
        publicMetrics: (user as any).public_metrics,
      },
      { upsert: true, new: true }
    );

    const allFollowers = await fetchAllFollowers(user.id);
    await saveFollowersToDB(user.id, allFollowers);

    await AccessGrant.findOneAndUpdate(
      { usernameLower },
      { username: user.username, usernameLower, active: true },
      { upsert: true, new: true }
    );

    const enrichment = await triggerEnrichment(user.id);

    return res.json({
      success: true,
      username: user.username,
      twitterId: user.id,
      followersSynced: allFollowers.length,
      enrichmentJobId: enrichment.jobId,
      message: 'Backfill complete, username whitelisted, enrichment triggered',
    });
  } catch (err: any) {
    console.error('[Admin] backfill-whitelist failed:', err);
    return res.status(500).json({
      error: err?.response?.data?.message || err?.message || 'Backfill + whitelist failed',
    });
  }
});

export default router;
