import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, LogOut, BarChart3, RefreshCw, AlertCircle, Loader2, Clock } from 'lucide-react';
import { getMe, logout, streamAllFollowers } from '../lib/api';
import type { StreamDonePayload } from '../lib/api';
import FollowerCard from '../components/FollowerCard';
import type { AuthUser, TwitterFollower } from '../types';

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

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch(() => navigate('/', { replace: true }));
  }, [navigate]);

  // Tick the cooldown timer every minute
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

  const handleDone = useCallback((payload: StreamDonePayload) => {
    setFromCache(payload.fromCache);
    if (payload.nextRefreshAt) {
      setNextRefreshAt(payload.nextRefreshAt);
    }
  }, []);

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
      }
    );

    stopRef.current = stopAll;
  }, [handleDone]);

  // Auto-start when user loads
  useEffect(() => {
    if (user) startFetch();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopRef.current?.(), []);

  const handleLogout = async () => {
    stopRef.current?.();
    await logout();
    navigate('/', { replace: true });
  };

  const canRefresh = cooldownRemaining <= 0;
  const currentFollowers = allFollowers;

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
        <div className="glass rounded-2xl p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4">
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
                  <p className="text-xl font-extrabold">{value != null ? value.toLocaleString() : '—'}</p>
                  <p className="text-xs text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

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
            {/* Live fetch status */}
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

            {/* Cooldown indicator */}
            {!canRefresh && !fetching && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-2 rounded-lg">
                <Clock className="w-3.5 h-3.5" />
                Refresh in {formatTimeRemaining(cooldownRemaining)}
              </div>
            )}

            <button
              onClick={startFetch}
              disabled={fetching || !canRefresh}
              title={!canRefresh ? `Next refresh available in ${formatTimeRemaining(cooldownRemaining)}` : 'Refresh followers'}
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

        {/* Loading skeleton — first load only */}
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

        {/* Followers grid — renders as batches stream in */}
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
      </main>
    </div>
  );
}
