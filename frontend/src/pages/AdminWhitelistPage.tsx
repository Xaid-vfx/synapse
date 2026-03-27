import { useEffect, useState } from 'react';
import {
  addWhitelistedUsername,
  backfillAndWhitelistUsername,
  adminLogin,
  adminLogout,
  adminStatus,
  getEarlyAccessLeads,
  getWhitelistedUsernames,
  removeWhitelistedUsername,
} from '../lib/api';

export default function AdminWhitelistPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inputUsername, setInputUsername] = useState('');
  const [backfillUsername, setBackfillUsername] = useState('');
  const [usernames, setUsernames] = useState<string[]>([]);
  const [leads, setLeads] = useState<Array<{ email: string; source: string; createdAt: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  const loadList = async () => {
    const list = await getWhitelistedUsernames();
    setUsernames(list);
  };

  const loadLeads = async () => {
    const rows = await getEarlyAccessLeads();
    setLeads(rows);
  };

  useEffect(() => {
    (async () => {
      try {
        const status = await adminStatus();
        setAuthenticated(status.authenticated);
        if (status.authenticated) {
          await Promise.all([loadList(), loadLeads()]);
        }
      } catch {
        // no-op
      }
    })();
  }, []);

  const handleLogin = async () => {
    setError(null);
    try {
      await adminLogin(username, password);
      setAuthenticated(true);
      await Promise.all([loadList(), loadLeads()]);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed');
    }
  };

  const handleAdd = async () => {
    if (!inputUsername.trim()) return;
    setError(null);
    setMessage(null);
    await addWhitelistedUsername(inputUsername.trim());
    setInputUsername('');
    await loadList();
  };

  const handleRemove = async (name: string) => {
    setError(null);
    setMessage(null);
    await removeWhitelistedUsername(name);
    await loadList();
  };

  const handleBackfillWhitelist = async () => {
    if (!backfillUsername.trim() || backfilling) return;
    setError(null);
    setMessage(null);
    setBackfilling(true);
    try {
      const result = await backfillAndWhitelistUsername(backfillUsername.trim());
      setMessage(
        `Backfill completed for @${result.username}. Synced ${result.followersSynced} followers and started enrichment (${result.enrichmentJobId.slice(0, 8)}...).`
      );
      setBackfillUsername('');
      await loadList();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Backfill + whitelist failed');
    } finally {
      setBackfilling(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-bg-dark text-white flex items-center justify-center px-6">
        <div className="glass rounded-2xl p-8 w-full max-w-md">
          <h1 className="text-xl font-bold">Admin whitelist</h1>
          <p className="text-slate-400 text-sm mt-2">Sign in to manage outreach usernames.</p>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Admin username"
            className="mt-5 w-full h-11 bg-bg-card border border-border-subtle rounded-lg px-3 text-sm"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="mt-3 w-full h-11 bg-bg-card border border-border-subtle rounded-lg px-3 text-sm"
          />
          {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
          <button onClick={handleLogin} className="mt-5 bg-primary text-bg-dark font-bold px-4 py-2.5 rounded-lg">
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark text-white px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Whitelist usernames</h1>
          <button
            onClick={async () => {
              await adminLogout();
              setAuthenticated(false);
            }}
            className="text-sm text-slate-400 hover:text-white"
          >
            Logout
          </button>
        </div>

        <p className="text-slate-400 mt-2 text-sm">
          Add Twitter usernames and share their public playground links for cold outreach.
        </p>
        {error && <p className="text-red-400 text-xs mt-3">{error}</p>}
        {message && <p className="text-emerald-400 text-xs mt-3">{message}</p>}

        <div className="flex gap-2 mt-6">
          <input
            value={inputUsername}
            onChange={(e) => setInputUsername(e.target.value)}
            placeholder="e.g. anaskhan"
            className="flex-1 h-11 bg-bg-card border border-border-subtle rounded-lg px-3 text-sm"
          />
          <button onClick={handleAdd} className="bg-primary text-bg-dark font-bold px-5 rounded-lg">
            Add
          </button>
        </div>

        <div className="glass rounded-xl p-4 mt-5">
          <p className="font-semibold text-sm">Backfill + whitelist</p>
          <p className="text-xs text-slate-400 mt-1">
            Runs full pipeline for this username (profile sync, follower backfill, enrichment trigger) and whitelists access.
          </p>
          <div className="flex gap-2 mt-3">
            <input
              value={backfillUsername}
              onChange={(e) => setBackfillUsername(e.target.value)}
              placeholder="e.g. anaskhan"
              className="flex-1 h-10 bg-bg-card border border-border-subtle rounded-lg px-3 text-sm"
            />
            <button
              onClick={handleBackfillWhitelist}
              disabled={backfilling}
              className="bg-primary text-bg-dark font-bold px-4 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {backfilling ? 'Running...' : 'Run'}
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          {usernames.map((name) => (
            <div key={name} className="glass rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold">@{name}</p>
                <p className="text-xs text-slate-400">{window.location.origin}/playground/{name}</p>
              </div>
              <button onClick={() => handleRemove(name)} className="text-xs text-red-400 hover:text-red-300">
                Remove
              </button>
            </div>
          ))}
          {usernames.length === 0 && <p className="text-slate-500 text-sm">No usernames whitelisted yet.</p>}
        </div>

        <div className="glass rounded-xl p-4 mt-8">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-sm">Early access signups</p>
            <button
              onClick={loadLeads}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Refresh
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            People who signed up directly from landing page.
          </p>

          <div className="mt-3 space-y-2">
            {leads.map((lead) => (
              <div key={`${lead.email}-${lead.createdAt}`} className="bg-bg-card border border-border-subtle rounded-lg px-3 py-2">
                <p className="text-sm font-medium">{lead.email}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {lead.source} · {new Date(lead.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
            {leads.length === 0 && <p className="text-slate-500 text-sm">No early access signups yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
