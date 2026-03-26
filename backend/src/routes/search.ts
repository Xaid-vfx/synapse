import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  semanticSearch,
  getSearchSuggestions,
} from '../services/searchService';
import { ENRICHMENT_CONFIG } from '../config/enrichment';

const router = Router();

router.get('/search', requireAuth, async (req: Request, res: Response) => {
  const reqStart = Date.now();
  const reqId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  try {
    const query = (req.query.q as string)?.trim();
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const limit = Math.min(
      parseInt(req.query.limit as string, 10) || ENRICHMENT_CONFIG.SEARCH_DEFAULT_LIMIT,
      ENRICHMENT_CONFIG.SEARCH_MAX_LIMIT,
    );

    const userId = req.session.user!.id;
    console.log(
      `[SearchAPI] Request start | reqId=${reqId} userId=${userId} query="${query}" limit=${limit}`,
    );
    const result = await semanticSearch(userId, query, limit);
    console.log(
      `[SearchAPI] Request success | reqId=${reqId} results=${result.results.length} totalCandidates=${result.totalCandidates} durationMs=${Date.now() - reqStart}`,
    );

    return res.json(result);
  } catch (err: any) {
    console.error(
      `[SearchAPI] Request failed | reqId=${reqId} durationMs=${Date.now() - reqStart}`,
      {
        message: err?.message,
        status: err?.response?.status,
        code: err?.code,
      },
    );
    return res.status(500).json({ error: err.message || 'Search failed' });
  }
});

router.get('/search/suggestions', requireAuth, async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string)?.trim();
    if (!query) return res.json({ suggestions: [] });

    const userId = req.session.user!.id;
    const suggestions = await getSearchSuggestions(userId, query);

    return res.json({ suggestions });
  } catch (err: any) {
    console.error('[Search] Suggestion error:', err);
    return res.json({ suggestions: [] });
  }
});

export default router;
