import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Search, X } from 'lucide-react';
import { getPlaygroundData, getMe, searchPlaygroundFollowers } from '../lib/api';
import SearchResultCard from '../components/SearchResultCard';
import type { PlaygroundFollower, PlaygroundOwner, SearchResult } from '../types';

export default function PlaygroundPage() {
  const navigate = useNavigate();
  const params = useParams<{ username?: string }>();
  const username = params.username || 'anaskhan';
  const [owner, setOwner] = useState<PlaygroundOwner | null>(null);
  const [followers, setFollowers] = useState<PlaygroundFollower[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        if (me.hasPaidAccess || me.hasWhitelistedAccess) {
          navigate('/dashboard', { replace: true });
          return;
        }
      } catch {
        // allow unauthenticated users to see playground
      }

      try {
        const data = await getPlaygroundData(username);
        setOwner(data.owner);
        setFollowers(data.followers);
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Unable to load playground data');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, username]);

  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setTotalCandidates(0);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const response = await searchPlaygroundFollowers(username, q, 20);
        setSearchResults(response.results);
        setTotalCandidates(response.totalCandidates);
      } catch (err: any) {
        setError(err?.response?.data?.error || 'Playground search failed');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-dark text-white px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-extrabold">Synapse Playground</h1>
          <p className="text-slate-400 text-sm mt-2">
            Loading follower data for @{username}. This can take a few seconds for larger accounts.
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm text-slate-300">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Fetching followers and search metadata...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark text-white px-6 py-10">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-extrabold">Synapse Playground</h1>
        <p className="text-slate-400 text-sm mt-2">
          Explore a sample follower intelligence view for @{username}. Unlock full access to analyze your own audience.
        </p>

        {!error && owner && (
          <div className="glass rounded-xl p-5 mt-6 flex items-center gap-4">
            {owner.profileImageUrl && (
              <img src={owner.profileImageUrl} alt={owner.name} className="w-14 h-14 rounded-full object-cover" />
            )}
            <div>
              <p className="font-bold">{owner.name}</p>
              <p className="text-sm text-slate-400">@{owner.username}</p>
              {owner.followersCount != null && (
                <p className="text-xs text-slate-500 mt-1">{owner.followersCount.toLocaleString()} followers</p>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-red-400 mt-6">{error}</p>}

        {!error && (
          <div className="mt-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search followers in playground (e.g. "founder", "ai", "vc")'
                className="w-full h-12 pl-11 pr-10 bg-bg-card border border-border-subtle rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/25 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setError(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {searching && (
                <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
              )}
            </div>

            {searchQuery.trim() ? (
              <>
                <p className="text-xs text-slate-400 mt-3">
                  {searchResults.length} semantic matches from {totalCandidates} candidates
                </p>
                {searchResults.length > 0 ? (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-4">
                    {searchResults.map((result, i) => (
                      <SearchResultCard key={result.followerId} result={result} rank={i + 1} />
                    ))}
                  </div>
                ) : (
                  !searching && (
                    <div className="text-sm text-slate-400 mt-8">
                      No semantic matches found. Try broader intent terms.
                    </div>
                  )
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-slate-400 mt-3">
                  Showing full follower list ({followers.length}). Search runs on the full vectorized follower set.
                </p>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {followers.map((follower) => (
                    <div key={follower.id} className="glass rounded-xl p-4">
                      <div className="flex items-center gap-3">
                        {follower.profile_image_url && (
                          <img src={follower.profile_image_url} alt={follower.name} className="w-10 h-10 rounded-full" />
                        )}
                        <div>
                          <p className="font-semibold text-sm">{follower.name}</p>
                          <p className="text-xs text-slate-400">@{follower.screen_name}</p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-300 mt-3 line-clamp-3">{follower.description || 'No bio'}</p>
                      <div className="text-xs text-slate-500 mt-3">
                        {follower.followers_count.toLocaleString()} followers {follower.verified ? '· Verified' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
