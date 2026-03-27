import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requirePaidAccess } from '../middleware/access';
import {
  triggerEnrichment,
  getEnrichmentStatus,
  getEnrichmentProgress,
  retryFailedEnrichment,
} from '../services/enrichmentService';
import { getRateLimitStatus } from '../services/rapidApiService';

const router = Router();

router.get('/enrichment/status', requireAuth, requirePaidAccess, async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;
    const status = await getEnrichmentStatus(userId);
    return res.json(status);
  } catch (err: any) {
    console.error('[Enrichment] Status error:', err);
    return res.status(500).json({ error: 'Failed to get enrichment status' });
  }
});

router.get('/enrichment/progress', requireAuth, requirePaidAccess, async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;
    const progress = await getEnrichmentProgress(userId);
    const rateLimit = getRateLimitStatus();
    return res.json({ ...progress, rateLimit });
  } catch (err: any) {
    console.error('[Enrichment] Progress error:', err);
    return res.status(500).json({ error: 'Failed to get enrichment progress' });
  }
});

router.post('/enrichment/trigger', requireAuth, requirePaidAccess, async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;
    const result = await triggerEnrichment(userId);
    return res.json(result);
  } catch (err: any) {
    console.error('[Enrichment] Trigger error:', err);
    return res.status(500).json({ error: 'Failed to trigger enrichment' });
  }
});

router.post('/enrichment/retry-failed', requireAuth, requirePaidAccess, async (req: Request, res: Response) => {
  try {
    const userId = req.session.user!.id;
    const result = await retryFailedEnrichment(userId);
    return res.json(result);
  } catch (err: any) {
    console.error('[Enrichment] Retry error:', err);
    return res.status(500).json({ error: 'Failed to retry enrichment' });
  }
});

export default router;
