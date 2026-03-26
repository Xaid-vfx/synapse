import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  LogOut,
  BarChart3,
  RefreshCw,
  AlertCircle,
  Loader2,
  Clock,
  Search,
  X,
  Zap,
  RotateCcw,
} from 'lucide-react';
import {
  getMe,
  logout,
  streamAllFollowers,
  searchFollowers,
  getEnrichmentProgress,
  triggerEnrichment,
  retryFailedEnrichment,
} from '../lib/api';
import type { StreamDonePayload } from '../lib/api';
import FollowerCard from '../components/FollowerCard';
import SearchResultCard from '../components/SearchResultCard';
import type {
  AuthUser,
  TwitterFollower,
  SearchResult,
  EnrichmentProgress,
} from '../types';

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '';
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);

  // Follower sync state
  const [allFollowers, setAllFollowers] = useState<TwitterFollower[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchedCount, setFetchedCount] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [nextRefreshAt, setNextRefreshAt] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [profileImageFailed, setProfileImageFailed] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSearchActive = searchQuery.trim().length > 0;

  // Enrichment state
  const [enrichment, setEnrichment] = useState<EnrichmentProgress | null>(null);
  const enrichmentPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // -----------------------------------------------------------------------
  // Auth
  // -----------------------------------------------------------------------
  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => navigate('/', { replace: true }));
  }, [navigate]);

  // -----------------------------------------------------------------------
  // Cooldown timer
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!nextRefreshAt) {
      setCooldownRemaining(0);
      return;
    }
    const calc = () => Math.max(0, new Date(nextRefreshAt).getTime() - Date.now());
    setCooldownRemaining(calc());
    const interval = setInterval(() => {
      const remaining = calc();
      setCooldownRemaining(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 60_000);
    return () => clearInterval(interval);
  }, [nextRefreshAt]);

  // -----------------------------------------------------------------------
  // Enrichment polling — runs while enrichment is in progress
  // -----------------------------------------------------------------------
  const pollEnrichment = useCallback(async () => {
    try {
      const progress = await getEnrichmentProgress();
      setEnrichment(progress);

      const isRunning = progress.pending > 0 || progress.running > 0;
      if (!isRunning && enrichmentPollRef.current) {
        clearInterval(enrichmentPollRef.current);
        enrichmentPollRef.current = null;
      }
    } catch {
      // Silently ignore polling errors
    }
  }, []);

  const startEnrichmentPolling = useCallback(() => {
    if (enrichmentPollRef.current) return;
    pollEnrichment();
    enrichmentPollRef.current = setInterval(pollEnrichment, 5000);
  }, [pollEnrichment]);

  const ensureEnrichmentStarted = useCallback(async () => {
    try {
      const progress = await getEnrichmentProgress();
      setEnrichment(progress);
      const hasWorkLeft = progress.done < progress.total;
      if (hasWorkLeft) {
        await triggerEnrichment();
      }
    } catch {
      // Non-blocking: fallback to polling anyway.
    } finally {
      startEnrichmentPolling();
    }
  }, [startEnrichmentPolling]);

  useEffect(() => {
    return () => {
      if (enrichmentPollRef.current) clearInterval(enrichmentPollRef.current);
    };
  }, []);

  // -----------------------------------------------------------------------
  // Follower sync
  // -----------------------------------------------------------------------
  const handleDone = useCallback(
    (payload: StreamDonePayload) => {
      setFromCache(payload.fromCache);
      if (payload.nextRefreshAt) setNextRefreshAt(payload.nextRefreshAt);
      ensureEnrichmentStarted();
    },
    [ensureEnrichmentStarted],
  );

  const startFetch = useCallback(() => {
    stopRef.current?.();
    setAllFollowers([]);
    setFetchedCount(0);
    setDone(false);
    setError(null);
    setFetching(true);
    setFromCache(false);

    const stopAll = streamAllFollowers(
      'all',
      (batch, total) => {
        setAllFollowers((prev) => [...prev, ...batch]);
        setFetchedCount(total);
      },
      (payload) => {
        handleDone(payload);
        setFetching(false);
        setDone(true);
      },
      (msg) => {
        setError(msg);
        setFetching(false);
      },
    );
    stopRef.current = stopAll;
  }, [handleDone]);

  useEffect(() => {
    if (user) startFetch();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopRef.current?.(), []);

  // -----------------------------------------------------------------------
  // Search (debounced)
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await searchFollowers(q, 20);
        setSearchResults(res.results);
        setTotalCandidates(res.totalCandidates);
        setSearchError(null);
      } catch (err: any) {
        setSearchError(err?.response?.data?.error || 'Search failed');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery]);

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------
  const handleLogout = async () => {
    stopRef.current?.();
    await logout();
    navigate('/', { replace: true });
  };

  const handleRetryFailed = async () => {
    try {
      await retryFailedEnrichment();
      startEnrichmentPolling();
    } catch {}
  };

  const canRefresh = cooldownRemaining <= 0;
  const currentFollowers = allFollowers;

  const enrichmentRunning =
    enrichment && (enrichment.pending > 0 || enrichment.running > 0);
  const enrichmentHasFailed = enrichment && enrichment.failed > 0;

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (!user) {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-primary/4 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border-subtle">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary p-1.5 rounded-lg">
              <BarChart3 className="w-4 h-4 text-bg-dark" strokeWidth={2.5} />
            </div>
            <span className="font-extrabold tracking-tight">Follower Intel</span>
          </div>

          <div className="flex items-center gap-3">
            {user.profileImageUrl && !profileImageFailed ? (
              <img
                src={user.profileImageUrl.replace('_normal', '_200x200')}
                alt={user.name}
                onError={() => setProfileImageFailed(true)}
                className="w-10 h-10 rounded-full ring-2 ring-primary/30 object-cover shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-bg-elevated flex items-center justify-center text-primary font-bold text-sm ring-2 ring-primary/20">
                {user.name.charAt(0)}
              </div>
            )}
            <div className="hidden sm:block">
              <p className="text-xs font-semibold leading-none">{user.name}</p>
              <p className="text-xs text-slate-400 leading-none mt-0.5">@{user.username}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5 ml-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 relative z-10">
        {/* User banner */}
        <div className="glass rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1">
            {user.profileImageUrl && (
              <img
                src={user.profileImageUrl.replace('_normal', '_200x200')}
                alt={user.name}
                className="w-14 h-14 rounded-full ring-2 ring-primary/20"
              />
            )}
            <div>
              <h1 className="text-lg font-bold">{user.name}</h1>
              <p className="text-slate-400 text-sm">@{user.username}</p>
              {user.description && (
                <p className="text-slate-300 text-xs mt-1 max-w-lg">{user.description}</p>
              )}
            </div>
          </div>

          {user.publicMetrics && (
            <div className="flex gap-6 sm:gap-8">
              {[
                { label: 'Followers', value: user.publicMetrics.followers_count },
                { label: 'Following', value: user.publicMetrics.following_count },
                { label: 'Tweets', value: user.publicMetrics.tweet_count },
              ].map(({ label, value }) => (
                <div key={label} className="text-center">
                  <p className="text-xl font-extrabold">
                    {value != null ? value.toLocaleString() : '—'}
                  </p>
                  <p className="text-xs text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Enrichment progress banner */}
        {enrichment && enrichment.total > 0 && (
          <div className="glass rounded-xl p-4 mb-6 border border-border-subtle">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${enrichmentRunning ? 'text-primary animate-pulse' : 'text-emerald-400'}`} />
                <span className="text-sm font-semibold">
                  {enrichmentRunning
                    ? 'Analyzing followers…'
                    : enrichment.done === enrichment.total
                      ? 'Analysis complete'
                      : 'Analysis paused'}
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {enrichment.done}/{enrichment.total} enriched
                {enrichment.failed > 0 && (
                  <span className="text-red-400 ml-2">{enrichment.failed} failed</span>
                )}
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${enrichment.percentComplete}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-slate-500">
                {enrichment.percentComplete}% complete
                {enrichmentRunning && ' — search improves as more followers are analyzed'}
              </span>

              {enrichmentHasFailed && !enrichmentRunning && (
                <button
                  onClick={handleRetryFailed}
                  className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Retry failed
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Search followers — try "backend developers", "AI founders", "early-stage VCs"…'
              className="w-full h-12 pl-11 pr-10 bg-bg-card border border-border-subtle rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
            />
            {searching && (
              <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Search results */}
        {isSearchActive && (
          <>
            {searchError && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 mb-6 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}

            {!searching && searchResults.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-slate-400">
                  {searchResults.length} results from {totalCandidates} candidates
                </span>
              </div>
            )}

            {!searching && searchResults.length === 0 && !searchError && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-bg-card border border-border-subtle flex items-center justify-center mb-4">
                  <Search className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-slate-400 font-semibold">No matches found</p>
                <p className="text-slate-500 text-sm mt-1">
                  {enrichment && enrichment.done < enrichment.total
                    ? 'More results will appear as follower analysis progresses.'
                    : 'Try a different search query.'}
                </p>
              </div>
            )}

            {searching && searchResults.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="glass rounded-xl p-4 animate-pulse">
                    <div className="flex gap-3 mb-3">
                      <div className="w-6 h-6 rounded-full bg-bg-elevated" />
                      <div className="w-11 h-11 rounded-full bg-bg-elevated" />
                      <div className="flex-1">
                        <div className="h-3.5 bg-bg-elevated rounded w-2/3 mb-2" />
                        <div className="h-3 bg-bg-elevated rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-3 bg-bg-elevated rounded w-full mb-2" />
                    <div className="h-3 bg-bg-elevated rounded w-3/4" />
                  </div>
                ))}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {searchResults.map((result, i) => (
                  <SearchResultCard key={result.followerId} result={result} rank={i + 1} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Original follower list (shown when not searching) */}
        {!isSearchActive && (
          <>
            {/* Tabs + status bar */}
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-bg-card rounded-xl border border-border-subtle text-sm font-semibold">
                <Users className="w-4 h-4 text-primary" />
                All Followers
                {allFollowers.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold bg-bg-elevated text-slate-300">
                    {allFollowers.length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3">
                {fetching && (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 border border-primary/20 px-3 py-2 rounded-lg">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {fromCache ? 'Loading from cache…' : 'Fetching followers…'}{' '}
                    {fetchedCount > 0 && <span className="font-bold">{fetchedCount} so far</span>}
                  </div>
                )}
                {done && (
                  <div className="text-xs text-slate-400 bg-bg-card border border-border-subtle px-3 py-2 rounded-lg">
                    {allFollowers.length.toLocaleString()} followers loaded
                    {fromCache && ' (cached)'}
                  </div>
                )}

                {!canRefresh && !fetching && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-2 rounded-lg">
                    <Clock className="w-3.5 h-3.5" />
                    Refresh in {formatTimeRemaining(cooldownRemaining)}
                  </div>
                )}

                <button
                  onClick={startFetch}
                  disabled={fetching || !canRefresh}
                  title={
                    !canRefresh
                      ? `Next refresh available in ${formatTimeRemaining(cooldownRemaining)}`
                      : 'Refresh followers'
                  }
                  className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors px-3 py-2 rounded-lg hover:bg-white/5 border border-border-subtle disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${fetching ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 mb-6 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Loading skeleton */}
            {fetching && currentFollowers.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="glass rounded-xl p-4 animate-pulse">
                    <div className="flex gap-3 mb-3">
                      <div className="w-11 h-11 rounded-full bg-bg-elevated" />
                      <div className="flex-1">
                        <div className="h-3.5 bg-bg-elevated rounded w-2/3 mb-2" />
                        <div className="h-3 bg-bg-elevated rounded w-1/2" />
                      </div>
                    </div>
                    <div className="h-3 bg-bg-elevated rounded w-full mb-2" />
                    <div className="h-3 bg-bg-elevated rounded w-3/4" />
                  </div>
                ))}
              </div>
            )}

            {/* Followers grid */}
            {currentFollowers.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {currentFollowers.map((follower) => (
                  <FollowerCard key={follower.id} follower={follower} />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!fetching && !error && done && currentFollowers.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-bg-card border border-border-subtle flex items-center justify-center mb-4">
                  <Users className="w-7 h-7 text-slate-500" />
                </div>
                <p className="text-slate-400 font-semibold">No followers found</p>
                <p className="text-slate-500 text-sm mt-1">Your follower list is empty.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
