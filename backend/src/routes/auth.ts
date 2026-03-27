import { Router, Request, Response } from 'express';
import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

const router = Router();

const CALLBACK_URL = process.env.TWITTER_CALLBACK_URL || 'http://localhost:3001/auth/twitter/callback';
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const SCOPES = ['users.read', 'tweet.read', 'follows.read', 'offline.access'];

function getTwitterClient() {
  return new TwitterApi({
    clientId: process.env.TWITTER_CLIENT_ID!,
    clientSecret: process.env.TWITTER_CLIENT_SECRET,
  });
}

// Step 1: Redirect user to Twitter OAuth
router.get('/twitter', async (req: Request, res: Response) => {
  try {
    const client = getTwitterClient();
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(CALLBACK_URL, {
      scope: SCOPES as string[],
    });

    req.session.codeVerifier = codeVerifier;
    req.session.state = state;

    // Persist session before redirect so OAuth callback still has state / codeVerifier (connect-mongo is async).
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('Session save failed before Twitter redirect:', saveErr);
        return res.redirect(`${FRONTEND_URL}?error=auth_init_failed`);
      }
      res.redirect(url);
    });
  } catch (error) {
    console.error('Error initiating Twitter OAuth:', error);
    res.redirect(`${FRONTEND_URL}?error=auth_init_failed`);
  }
});

// Step 2: Handle OAuth callback from Twitter
router.get('/twitter/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  const { codeVerifier, state: sessionState } = req.session;

  if (error) {
    console.error('Twitter OAuth error:', error);
    return res.redirect(`${FRONTEND_URL}?error=access_denied`);
  }

  if (!code || !state || state !== sessionState || !codeVerifier) {
    console.error('OAuth state mismatch or missing parameters');
    return res.redirect(`${FRONTEND_URL}?error=invalid_state`);
  }

  try {
    const client = getTwitterClient();
    const { client: loggedClient, accessToken, refreshToken } = await client.loginWithOAuth2({
      code: code as string,
      codeVerifier,
      redirectUri: CALLBACK_URL,
    });

    const { data: userObject } = await loggedClient.v2.me({
      'user.fields': ['profile_image_url', 'public_metrics', 'description', 'verified'],
    });

    const dbUser = await User.findOneAndUpdate(
      { twitterId: userObject.id },
      {
        name: userObject.name,
        username: userObject.username,
        profileImageUrl: userObject.profile_image_url,
        description: (userObject as any).description,
        publicMetrics: (userObject as any).public_metrics,
        accessToken,
        ...(refreshToken ? { refreshToken } : {}),
      },
      { upsert: true, new: true }
    );

    req.session.user = {
      id: dbUser.twitterId,
      name: dbUser.name,
      username: dbUser.username,
      profileImageUrl: dbUser.profileImageUrl,
      description: dbUser.description,
      publicMetrics: dbUser.publicMetrics,
    };
    req.session.accessToken = accessToken;
    if (refreshToken) req.session.refreshToken = refreshToken;

    delete req.session.codeVerifier;
    delete req.session.state;

    res.redirect(`${FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error('Error during OAuth callback:', err);
    res.redirect(`${FRONTEND_URL}?error=auth_failed`);
  }
});

// Get current authenticated user
router.get('/me', (req: Request, res: Response) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json(req.session.user);
});

// Logout
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});

export default router;
