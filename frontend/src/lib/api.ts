import axios from 'axios';
import type {
  AuthUser,
  FollowersApiResponse,
  RefreshStatus,
  TwitterFollower,
  SearchResponse,
  EnrichmentProgress,
  EnrichmentStatusResponse,
} from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export async function getMe(): Promise<AuthUser> {
  const res = await api.get<AuthUser>('/auth/me');
  if (!res.data?.id || !res.data?.username) {
    throw new Error('Not authenticated');
  }
  return res.data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

// ---------------------------------------------------------------------------
// Followers (existing)
// ---------------------------------------------------------------------------
export async function getFollowers(cursor?: string): Promise<FollowersApiResponse> {
  const params: Record<string, string> = {};
  if (cursor) params.cursor = cursor;
  const res = await api.get<FollowersApiResponse>('/api/followers', { params });
  return res.data;
}

export async function getVerifiedFollowers(cursor?: string): Promise<FollowersApiResponse> {
  const params: Record<string, string> = {};
  if (cursor) params.cursor = cursor;
  const res = await api.get<FollowersApiResponse>('/api/verified-followers', { params });
  return res.data;
}

export async function getRefreshStatus(): Promise<RefreshStatus> {
  const res = await api.get<RefreshStatus>('/api/refresh-status');
  return res.data;
}

export interface StreamDonePayload {
  total: number;
  fromCache: boolean;
  nextRefreshAt?: string;
}

export function streamAllFollowers(
  type: 'all' | 'verified',
  onBatch: (followers: TwitterFollower[], total: number) => void,
  onDone: (payload: StreamDonePayload) => void,
  onError: (msg: string) => void,
): () => void {
  const path = type === 'verified' ? '/api/verified-followers/all' : '/api/followers/all';
  const es = new EventSource(`${BASE_URL}${path}`, { withCredentials: true });

  es.addEventListener('followers', (e) => {
    const data = JSON.parse(e.data) as { followers: TwitterFollower[]; total: number };
    onBatch(data.followers, data.total);
  });

  es.addEventListener('done', (e) => {
    const data = JSON.parse(e.data) as StreamDonePayload;
    onDone(data);
    es.close();
  });

  es.addEventListener('error', (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data) as { message: string };
      onError(data.message);
    } catch {
      onError('Stream error — check your connection.');
    }
    es.close();
  });

  es.onerror = () => {
    onError('Connection lost. Please try again.');
    es.close();
  };

  return () => es.close();
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export async function searchFollowers(
  query: string,
  limit = 20,
): Promise<SearchResponse> {
  const res = await api.get<SearchResponse>('/api/search', {
    params: { q: query, limit },
  });
  return res.data;
}

export async function getSearchSuggestions(
  query: string,
): Promise<string[]> {
  const res = await api.get<{ suggestions: string[] }>('/api/search/suggestions', {
    params: { q: query },
  });
  return res.data.suggestions;
}

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------
export async function getEnrichmentStatus(): Promise<EnrichmentStatusResponse> {
  const res = await api.get<EnrichmentStatusResponse>('/api/enrichment/status');
  return res.data;
}

export async function getEnrichmentProgress(): Promise<EnrichmentProgress> {
  const res = await api.get<EnrichmentProgress>('/api/enrichment/progress');
  return res.data;
}

export async function triggerEnrichment(): Promise<{ jobId: string; message: string }> {
  const res = await api.post<{ jobId: string; message: string }>('/api/enrichment/trigger');
  return res.data;
}

export async function retryFailedEnrichment(): Promise<{ count: number; message: string }> {
  const res = await api.post<{ count: number; message: string }>('/api/enrichment/retry-failed');
  return res.data;
}
