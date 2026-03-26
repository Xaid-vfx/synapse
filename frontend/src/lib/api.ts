import axios from 'axios';
import type { AuthUser, FollowersApiResponse, TwitterFollower } from '../types';

const api = axios.create({
  baseURL: '/',
  withCredentials: true,
});

export async function getMe(): Promise<AuthUser> {
  const res = await api.get<AuthUser>('/auth/me');
  return res.data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

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

/**
 * Stream ALL followers via SSE. Calls onBatch for each page received,
 * onDone when complete, onError on failure.
 * Returns a cleanup function to abort the stream.
 */
export function streamAllFollowers(
  type: 'all' | 'verified',
  onBatch: (followers: TwitterFollower[], total: number) => void,
  onDone: (total: number) => void,
  onError: (msg: string) => void
): () => void {
  const url = type === 'verified' ? '/api/verified-followers/all' : '/api/followers/all';
  const es = new EventSource(url);

  es.addEventListener('followers', (e) => {
    const data = JSON.parse(e.data) as { followers: TwitterFollower[]; total: number };
    onBatch(data.followers, data.total);
  });

  es.addEventListener('done', (e) => {
    const data = JSON.parse(e.data) as { total: number };
    onDone(data.total);
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

  // Native SSE error (connection dropped etc.)
  es.onerror = () => {
    onError('Connection lost. Please try again.');
    es.close();
  };

  return () => es.close();
}
