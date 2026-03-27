export interface AuthUser {
  id: string;
  name: string;
  username: string;
  profileImageUrl?: string;
  description?: string;
  hasPaidAccess?: boolean;
  hasWhitelistedAccess?: boolean;
  publicMetrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
  };
}

export interface BillingStatus {
  hasPaidAccess: boolean;
  followersCount: number;
  price: number;
}

export interface PlaygroundOwner {
  name: string;
  username: string;
  profileImageUrl?: string;
  followersCount?: number | null;
}

export interface PlaygroundFollower {
  id: string;
  name: string;
  screen_name: string;
  description: string | null;
  followers_count: number;
  verified: boolean;
  profile_image_url: string | null;
}

export interface PlaygroundPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface PlaygroundDataResponse {
  owner: PlaygroundOwner;
  followers: PlaygroundFollower[];
  pagination: PlaygroundPagination;
}

export interface TwitterFollower {
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

export interface FollowersApiResponse {
  followers: TwitterFollower[];
  next_cursor: string | null;
}

export interface RefreshStatus {
  canRefresh: boolean;
  nextRefreshAt?: string;
  lastFetchedAt?: string;
}

export type FollowersTab = 'all' | 'verified';

// ---------------------------------------------------------------------------
// Search types
// ---------------------------------------------------------------------------
export interface ScoreBreakdown {
  semantic: number;
  reputation: number;
  recency: number;
  intentBoost: number;
  finalScore: number;
}

export interface SearchResult {
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
  scoreBreakdown: ScoreBreakdown;
  matchedTopics: string[];
  topSupportingSnippets: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  queryTopics: string[];
  totalCandidates: number;
}

// ---------------------------------------------------------------------------
// Enrichment types
// ---------------------------------------------------------------------------
export interface EnrichmentProgress {
  total: number;
  done: number;
  failed: number;
  running: number;
  pending: number;
  percentComplete: number;
  rateLimit?: {
    dailyRemaining: number;
    dailyCap: number;
  };
}

export interface EnrichmentStatusResponse {
  job: {
    id: string;
    status: string;
    totalFollowers: number;
    enrichedCount: number;
    failedCount: number;
    startedAt: string | null;
    completedAt: string | null;
  } | null;
  followerCounts: {
    total: number;
    done: number;
    pending: number;
    running: number;
    failed: number;
  };
}
