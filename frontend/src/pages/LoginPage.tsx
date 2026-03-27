import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Zap, BarChart3, AlertCircle } from 'lucide-react';
import { getMe } from '../lib/api';
import Seo from '../components/Seo';

const LOGIN_SEO_DESC =
  'Sign in with X to connect your account and open your follower dashboard.';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError) {
      const messages: Record<string, string> = {
        auth_failed: 'Authentication failed. Please try again.',
        access_denied: 'Access was denied. Please authorize the app to continue.',
        invalid_state: 'Security check failed. Please try again.',
        auth_init_failed: 'Could not start authentication. Check your app configuration.',
      };
      setError(messages[urlError] ?? 'An unexpected error occurred.');
    }

    // Check if already logged in
    getMe()
      .then(() => navigate('/dashboard', { replace: true }))
      .catch(() => setChecking(false));
  }, [navigate, searchParams]);

  if (checking) {
    return (
      <>
        <Seo title="Synapse — Sign in" description={LOGIN_SEO_DESC} />
        <div className="min-h-screen bg-bg-dark flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Seo title="Synapse — Sign in" description={LOGIN_SEO_DESC} />
      <div className="min-h-screen bg-bg-dark flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="bg-primary p-2.5 rounded-xl">
            <BarChart3 className="w-6 h-6 text-bg-dark" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-extrabold tracking-tight">Synapse</span>
        </div>

        {/* Main card */}
        <div className="glass rounded-2xl p-8 glow-primary">
          <h1 className="text-2xl font-bold text-center mb-2">Analyze Your Audience</h1>
          <p className="text-slate-400 text-center text-sm mb-8 leading-relaxed">
            Connect your X account to fetch your followers and get intelligence on who's following you.
          </p>

          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 mb-6 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Features */}
          <div className="space-y-3 mb-8">
            {[
              { icon: Users, label: 'View all your followers' },
              { icon: Zap, label: 'Identify verified accounts' },
              { icon: BarChart3, label: 'Score and analyze each follower' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-sm text-slate-300">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-primary" />
                </div>
                {label}
              </div>
            ))}
          </div>

          {/* Sign in button */}
          <a
            href={`${import.meta.env.VITE_API_URL ?? ''}/auth/twitter`}
            className="flex items-center justify-center gap-3 w-full bg-white text-black font-bold py-3.5 px-6 rounded-xl hover:bg-slate-100 transition-all duration-200 text-sm"
          >
            {/* X (Twitter) logo */}
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.766l7.73-8.835L1.254 2.25H8.08l4.213 5.567L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
            </svg>
            Continue with X
          </a>

          <p className="text-xs text-slate-500 text-center mt-4">
            Read-only access · We never post on your behalf
          </p>
        </div>
      </div>
    </div>
    </>
  );
}
