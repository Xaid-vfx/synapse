import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { requireAuth } from '../middleware/auth';
import User from '../models/User';

const router = Router();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

type PlanTier = 'starter_29' | 'growth_49' | 'scale_79';

function getPlanTierFromFollowers(followersCount: number): PlanTier {
  if (followersCount <= 10_000) return 'starter_29';
  if (followersCount <= 100_000) return 'growth_49';
  return 'scale_79';
}

function getPriceIdForTier(tier: PlanTier): string | undefined {
  if (tier === 'starter_29') return process.env.STRIPE_PRICE_ID_STARTER_29;
  if (tier === 'growth_49') return process.env.STRIPE_PRICE_ID_GROWTH_49;
  return process.env.STRIPE_PRICE_ID_SCALE_79;
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
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe is not configured' });
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
  const priceId = getPriceIdForTier(tier);
  if (!priceId) {
    return res.status(500).json({ error: `Missing Stripe price configuration for ${tier}` });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${frontendUrl}/billing/success`,
    cancel_url: `${frontendUrl}/pricing`,
    customer_email: undefined,
    metadata: {
      twitterId: dbUser.twitterId,
      username: dbUser.username,
      tier,
    },
  });

  dbUser.stripeCheckoutSessionId = session.id;
  dbUser.paidPlanTier = tier;
  await dbUser.save();

  return res.json({ url: session.url });
});

router.post('/billing/webhook', async (req: Request, res: Response) => {
  if (!stripe || !webhookSecret) {
    return res.status(500).send('Stripe webhook not configured');
  }

  const signature = req.headers['stripe-signature'];
  if (!signature || typeof signature !== 'string') {
    return res.status(400).send('Missing stripe-signature header');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const twitterId = session.metadata?.twitterId;
    const tier = session.metadata?.tier as PlanTier | undefined;
    if (twitterId) {
      await User.updateOne(
        { twitterId },
        {
          hasPaidAccess: true,
          paidAt: new Date(),
          ...(tier ? { paidPlanTier: tier } : {}),
          ...(session.customer ? { stripeCustomerId: String(session.customer) } : {}),
          stripeCheckoutSessionId: session.id,
        }
      );
    }
  }

  return res.json({ received: true });
});

export default router;
