import { Router, Request, Response } from 'express';
import { Polar } from '@polar-sh/sdk';
import { requireAuth } from '../middleware/auth';
import User from '../models/User';

// @polar-sh/sdk/webhooks subpath isn't reachable via legacy 'node' moduleResolution — use require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { validateEvent, WebhookVerificationError } = require('@polar-sh/sdk/dist/commonjs/webhooks') as {
  validateEvent: (body: Buffer | string, headers: Record<string, string>, secret: string) => { type: string; data: Record<string, unknown> };
  WebhookVerificationError: new (...args: unknown[]) => Error;
};

const router = Router();

const polarAccessToken = process.env.POLAR_ACCESS_TOKEN;
const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const polar = polarAccessToken ? new Polar({ accessToken: polarAccessToken }) : null;

type PlanTier = 'starter_29' | 'growth_49' | 'scale_79';

function getPlanTierFromFollowers(followersCount: number): PlanTier {
  if (followersCount <= 10_000) return 'starter_29';
  if (followersCount <= 100_000) return 'growth_49';
  return 'scale_79';
}

function getProductIdForTier(tier: PlanTier): string | undefined {
  if (tier === 'starter_29') return process.env.POLAR_PRODUCT_ID_STARTER_29;
  if (tier === 'growth_49') return process.env.POLAR_PRODUCT_ID_GROWTH_49;
  return process.env.POLAR_PRODUCT_ID_SCALE_79;
}

router.get('/billing/status', requireAuth, async (req: Request, res: Response) => {
  const user = await User.findOne({ twitterId: req.session.user!.id }).lean();
  const followersCount = user?.publicMetrics?.followers_count ?? req.session.user?.publicMetrics?.followers_count ?? 0;
  const tier = getPlanTierFromFollowers(followersCount);
  return res.json({
    hasPaidAccess: Boolean(user?.hasPaidAccess),
    recommendedTier: tier,
    followersCount,
  });
});

router.post('/billing/create-checkout-session', requireAuth, async (req: Request, res: Response) => {
  if (!polar) {
    return res.status(500).json({ error: 'Polar is not configured' });
  }

  const dbUser = await User.findOne({ twitterId: req.session.user!.id });
  if (!dbUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (dbUser.hasPaidAccess) {
    return res.json({ alreadyPaid: true, redirectTo: `${frontendUrl}/dashboard` });
  }

  const followersCount = dbUser.publicMetrics?.followers_count ?? req.session.user?.publicMetrics?.followers_count ?? 0;
  const tier = getPlanTierFromFollowers(followersCount);
  const productId = getProductIdForTier(tier);
  if (!productId) {
    return res.status(500).json({ error: `Missing Polar product configuration for ${tier}` });
  }

  const checkout = await polar.checkouts.create({
    products: [productId],
    successUrl: `${frontendUrl}/billing/success`,
    metadata: {
      twitterId: dbUser.twitterId,
      username: dbUser.username,
      tier,
    },
  });

  dbUser.polarCheckoutId = checkout.id;
  dbUser.paidPlanTier = tier;
  await dbUser.save();

  return res.json({ url: checkout.url });
});

router.post('/billing/webhook', async (req: Request, res: Response) => {
  if (!webhookSecret) {
    return res.status(500).send('Polar webhook not configured');
  }

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = validateEvent(req.body as Buffer, req.headers as Record<string, string>, webhookSecret);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return res.status(403).send('Webhook verification failed');
    }
    return res.status(400).send('Invalid webhook payload');
  }

  if (event.type === 'order.created') {
    const order = event.data as Record<string, unknown>;
    const meta = (order.metadata ?? {}) as Record<string, string>;
    const twitterId = meta.twitterId;
    const tier = meta.tier as PlanTier | undefined;
    if (twitterId) {
      await User.updateOne(
        { twitterId },
        {
          hasPaidAccess: true,
          paidAt: new Date(),
          ...(tier ? { paidPlanTier: tier } : {}),
          polarOrderId: String(order.id ?? ''),
          ...(order.customerId ? { polarCustomerId: String(order.customerId) } : {}),
        }
      );
    }
  }

  return res.json({ received: true });
});

export default router;
