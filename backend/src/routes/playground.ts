import { Router, Request, Response } from 'express';
import User from '../models/User';
import Follower from '../models/Follower';
import { hasAccessForUsername } from '../middleware/access';
import { semanticSearch } from '../services/searchService';

const router = Router();

async function resolvePlaygroundOwner(requestedUsername: string) {
  if (!requestedUsername) {
    return { error: 'username is required' as const };
  }

  const usernameLower = requestedUsername.toLowerCase();
  const normalizedLookupUsername = usernameLower === 'anaskhan' ? 'muhamdanaskhan' : requestedUsername;
  const allowDemo = usernameLower === 'anaskhan';
  const allowed = allowDemo || (await hasAccessForUsername(requestedUsername));
  if (!allowed) {
    return { error: 'This username is not available in playground yet' as const };
  }

  const owner = await User.findOne({ username: new RegExp(`^${normalizedLookupUsername}$`, 'i') }).lean();
  if (!owner) {
    return { error: 'User data not found in database' as const };
  }
  return { owner };
}

router.get('/playground/:username', async (req: Request, res: Response) => {
  const requestedUsername = String(req.params.username || '').trim().replace(/^@/, '');
  const resolved = await resolvePlaygroundOwner(requestedUsername);
  if ('error' in resolved) {
    const code =
      resolved.error === 'username is required'
        ? 400
        : resolved.error === 'User data not found in database'
          ? 404
          : 403;
    return res.status(code).json({ error: resolved.error });
  }
  const { owner } = resolved;

  const followers = await Follower.find({ userId: owner.twitterId, type: 'all' }).lean();

  return res.json({
    owner: {
      name: owner.name,
      username: owner.username,
      profileImageUrl: owner.profileImageUrl,
      followersCount: owner.publicMetrics?.followers_count ?? null,
    },
    followers: followers.map((f) => ({
      id: f.followerId,
      name: f.name,
      screen_name: f.screen_name,
      description: f.description,
      followers_count: f.followers_count,
      verified: f.verified,
      profile_image_url: f.profile_image_url,
    })),
  });
});

router.get('/playground/:username/search', async (req: Request, res: Response) => {
  const requestedUsername = String(req.params.username || '').trim().replace(/^@/, '');
  const query = String(req.query.q || '').trim();
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  const resolved = await resolvePlaygroundOwner(requestedUsername);
  if ('error' in resolved) {
    const code =
      resolved.error === 'username is required'
        ? 400
        : resolved.error === 'User data not found in database'
          ? 404
          : 403;
    return res.status(code).json({ error: resolved.error });
  }

  const limit = Math.min(parseInt(String(req.query.limit || '20'), 10) || 20, 50);
  const totalVectorFollowers = await Follower.countDocuments({
    userId: resolved.owner.twitterId,
    type: 'all',
    'enrichment.status': 'done',
  });
  const vectorLimit = Math.max(totalVectorFollowers, limit);
  const numCandidates = Math.max(vectorLimit, 200);
  const result = await semanticSearch(resolved.owner.twitterId, query, limit, {
    vectorLimit,
    numCandidates,
  });
  return res.json(result);
});

export default router;
