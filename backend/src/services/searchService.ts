import Follower from '../models/Follower';
import { generateSingleEmbedding } from './embeddingService';
import { extractTopicTags } from './searchDocumentService';
import { ENRICHMENT_CONFIG } from '../config/enrichment';

const { RERANK_WEIGHTS } = ENRICHMENT_CONFIG;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface SearchResultItem {
  followerId: string;
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
  topicTags: string[];
  reputationScore: number;
  scoreBreakdown: {
    semantic: number;
    reputation: number;
    recency: number;
    intentBoost: number;
    finalScore: number;
  };
  matchedTopics: string[];
  topSupportingSnippets: string[];
}

export interface SearchResponse {
  results: SearchResultItem[];
  queryTopics: string[];
  totalCandidates: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function recencyBoost(enrichment: any, activity: any): number {
  if (!enrichment?.enrichedAt) return 0;

  const daysSince =
    (Date.now() - new Date(enrichment.enrichedAt).getTime()) /
    (1000 * 60 * 60 * 24);
  const freshness = Math.max(0, 1 - daysSince / 30);

  const actScore =
    activity?.tweetFrequency30d > 0
      ? Math.min(1, activity.tweetFrequency30d / 30)
      : 0;

  return freshness * 0.4 + actScore * 0.6;
}

function intentBoost(queryTopics: string[], followerTopics: string[]): number {
  if (queryTopics.length === 0 || followerTopics.length === 0) return 0;
  const overlap = queryTopics.filter((t) => followerTopics.includes(t));
  return Math.min(1, overlap.length / Math.max(1, queryTopics.length));
}

function extractSnippets(doc: string, query: string): string[] {
  if (!doc) return [];
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const sentences = doc
    .split(/[.|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  return sentences
    .map((s) => ({
      text: s,
      score: terms.filter((t) => s.toLowerCase().includes(t)).length,
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.text.slice(0, 200));
}

// ---------------------------------------------------------------------------
// Main search
// ---------------------------------------------------------------------------
export async function semanticSearch(
  userId: string,
  query: string,
  limit = ENRICHMENT_CONFIG.SEARCH_DEFAULT_LIMIT,
  options?: {
    vectorLimit?: number;
    numCandidates?: number;
  },
): Promise<SearchResponse> {
  const startedAt = Date.now();
  console.log(
    `[SearchPipeline] Start | userId=${userId} query="${query}" requestedLimit=${limit}`,
  );
  const effectiveLimit = Math.min(
    limit,
    ENRICHMENT_CONFIG.SEARCH_MAX_LIMIT,
  );

  const embeddingStart = Date.now();
  const queryEmbedding = await generateSingleEmbedding(query);
  console.log(
    `[SearchPipeline] Query embedding complete | durationMs=${Date.now() - embeddingStart}`,
  );
  const queryTopics = extractTopicTags(query);
  console.log(
    `[SearchPipeline] Query topics extracted | topics=${queryTopics.join(',') || 'none'}`,
  );

  let candidates: any[];
  const vectorLimit = Math.max(
    effectiveLimit,
    options?.vectorLimit ?? ENRICHMENT_CONFIG.VECTOR_DEFAULT_K,
  );
  const vectorNumCandidates = Math.max(
    vectorLimit,
    options?.numCandidates ?? ENRICHMENT_CONFIG.VECTOR_NUM_CANDIDATES,
  );

  try {
    const vectorStart = Date.now();
    candidates = await Follower.aggregate([
      {
        $vectorSearch: {
          index: ENRICHMENT_CONFIG.VECTOR_INDEX_NAME,
          path: 'semantic.embedding',
          queryVector: queryEmbedding,
          numCandidates: vectorNumCandidates,
          limit: vectorLimit,
          filter: { userId },
        },
      },
      { $addFields: { _vsScore: { $meta: 'vectorSearchScore' } } },
      {
        $project: {
          followerId: 1,
          name: 1,
          screen_name: 1,
          profile_image_url: 1,
          description: 1,
          location: 1,
          followers_count: 1,
          following_count: 1,
          tweet_count: 1,
          is_blue_verified: 1,
          verified: 1,
          banner_url: 1,
          searchDocument: 1,
          topicTags: 1,
          reputationScore: 1,
          activityMetrics: 1,
          enrichment: 1,
          _vsScore: 1,
        },
      },
    ]);
    console.log(
      `[SearchPipeline] Vector retrieval complete | candidates=${candidates.length} durationMs=${Date.now() - vectorStart}`,
    );
  } catch (err: any) {
    // Graceful fallback when vector index is not yet created
    console.warn(
      '[Search] Vector search unavailable, falling back to text match:',
      err.message,
    );
    const fallbackStart = Date.now();
    candidates = await textFallback(userId, query);
    console.log(
      `[SearchPipeline] Text fallback complete | candidates=${candidates.length} durationMs=${Date.now() - fallbackStart}`,
    );
  }

  // Re-rank
  const ranked: SearchResultItem[] = candidates.map((c) => {
    const sem = c._vsScore ?? 0;
    const rep = (c.reputationScore ?? 0) / 100;
    const rec = recencyBoost(c.enrichment, c.activityMetrics);
    const intent = intentBoost(queryTopics, c.topicTags ?? []);

    const final =
      RERANK_WEIGHTS.semantic * sem +
      RERANK_WEIGHTS.reputation * rep +
      RERANK_WEIGHTS.recency * rec +
      RERANK_WEIGHTS.intent * intent;

    return {
      followerId: c.followerId,
      name: c.name,
      screen_name: c.screen_name,
      profile_image_url: c.profile_image_url,
      description: c.description,
      location: c.location,
      followers_count: c.followers_count,
      following_count: c.following_count,
      tweet_count: c.tweet_count,
      is_blue_verified: c.is_blue_verified,
      verified: c.verified,
      banner_url: c.banner_url,
      topicTags: c.topicTags ?? [],
      reputationScore: c.reputationScore ?? 0,
      scoreBreakdown: {
        semantic: Math.round(sem * 1000) / 1000,
        reputation: Math.round(rep * 1000) / 1000,
        recency: Math.round(rec * 1000) / 1000,
        intentBoost: Math.round(intent * 1000) / 1000,
        finalScore: Math.round(final * 1000) / 1000,
      },
      matchedTopics: (c.topicTags ?? []).filter((t: string) =>
        queryTopics.includes(t),
      ),
      topSupportingSnippets: extractSnippets(c.searchDocument ?? '', query),
    };
  });

  ranked.sort(
    (a, b) => b.scoreBreakdown.finalScore - a.scoreBreakdown.finalScore,
  );

  console.log(
    `[SearchPipeline] Complete | returned=${Math.min(ranked.length, effectiveLimit)} candidates=${candidates.length} durationMs=${Date.now() - startedAt}`,
  );
  return {
    results: ranked.slice(0, effectiveLimit),
    queryTopics,
    totalCandidates: candidates.length,
  };
}

// ---------------------------------------------------------------------------
// Text-based fallback for pre-vector-index usage
// ---------------------------------------------------------------------------
async function textFallback(userId: string, query: string) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const orClauses = terms.flatMap((t) => [
    { searchDocument: { $regex: t, $options: 'i' } },
    { topicTags: { $regex: t, $options: 'i' } },
    { description: { $regex: t, $options: 'i' } },
    { name: { $regex: t, $options: 'i' } },
  ]);

  const filter: any = { userId, type: 'all', 'enrichment.status': 'done' };
  if (orClauses.length > 0) filter.$or = orClauses;

  const results = await Follower.find(filter)
    .sort({ reputationScore: -1 })
    .limit(ENRICHMENT_CONFIG.VECTOR_DEFAULT_K)
    .lean();

  return results.map((r: any) => ({ ...r, _vsScore: 0.5 }));
}

// ---------------------------------------------------------------------------
// Autocomplete suggestions based on known topic tags
// ---------------------------------------------------------------------------
export async function getSearchSuggestions(
  userId: string,
  query: string,
  limit = 8,
): Promise<string[]> {
  const allTags: string[] = await Follower.distinct('topicTags', {
    userId,
    'enrichment.status': 'done',
  });

  const lower = query.toLowerCase();
  return allTags
    .filter((tag) => tag.toLowerCase().includes(lower))
    .slice(0, limit);
}
