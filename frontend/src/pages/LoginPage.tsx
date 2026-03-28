import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Zap, BarChart3, AlertCircle } from 'lucide-react';
import { getMe } from '../lib/api';
import Seo from '../components/Seo';

const API_URL = import.meta.env.VITE_API_URL ?? '';

const LOGIN_SEO_DESC =
  'Synapse — follower intelligence for creators and operators. Find investors, collaborators, and your most valuable audience.';

const pricingTiers = [
  { range: '< 1k followers',   price: '$4.99–$7.99' },
  { range: '1k–25k followers', price: '$14.99–$34.99' },
  { range: '25k–250k followers', price: '$39.99–$64.99' },
  { range: '250k+ followers',  price: '$74.99–$99.99' },
];

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
        access_denied: 'Access was denied. Please authorise the app to continue.',
        invalid_state: 'Security check failed. Please try again.',
        auth_init_failed: 'Could not start authentication. Check your app configuration.',
      };
      setError(messages[urlError] ?? 'An unexpected error occurred.');
    }

    getMe()
      .then((user) => {
        if (user.hasPaidAccess || user.hasWhitelistedAccess) {
          navigate('/dashboard', { replace: true });
          return;
        }
        navigate('/pricing', { replace: true });
      })
      .catch(() => setChecking(false));
  }, [navigate, searchParams]);

  if (checking) {
    return (
      <>
        <Seo title="Synapse" description={LOGIN_SEO_DESC} />
        <div className="min-h-screen bg-bg-dark flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Seo title="Synapse — Follower Intelligence" description={LOGIN_SEO_DESC} />
      <div className="min-h-screen bg-bg-dark px-4 py-10 sm:py-14 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-15%] left-[5%] w-[460px] h-[460px] bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-[15%] right-[4%] w-[360px] h-[360px] bg-cyan-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-22%] left-1/2 -translate-x-1/2 w-[780px] h-[780px] bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
        </div>

        <div className="relative z-10 w-full max-w-6xl mx-auto">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-7">
            <div className="bg-primary p-2.5 rounded-xl shadow-[0_0_0_8px_rgba(13,185,242,0.09)]">
              <BarChart3 className="w-6 h-6 text-bg-dark" strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">Synapse</span>
          </div>
          <p className="text-center text-slate-400 text-sm max-w-2xl mx-auto">
            Follower intelligence for creators and operators.
          </p>

          <div className="mt-8 flex flex-col items-center gap-6">
            {/* Main card */}
            <div className="glass rounded-3xl p-7 sm:p-8 glow-primary border border-primary/20 shadow-[0_20px_90px_rgba(13,185,242,0.14)] w-full max-w-xl">
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Understand your audience</h1>
              <p className="text-slate-300 text-sm mt-3 mb-6 leading-relaxed">
                Connect your X account to see who's following you — investors, founders, creators, and more.
              </p>

              {error && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 mb-6 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-3 mb-7">
                {[
                  { icon: Users, label: 'See every follower with enriched profiles' },
                  { icon: Zap, label: 'AI-scored by relevance, role, and reach' },
                  { icon: BarChart3, label: 'Search and filter your entire audience' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 text-sm text-slate-200">
                    <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    {label}
                  </div>
                ))}
              </div>

              <a
                href={`${API_URL}/auth/twitter`}
                className="flex items-center justify-center gap-3 w-full bg-white text-black font-bold py-3.5 px-6 rounded-xl text-sm hover:bg-white/90 transition-opacity"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-black" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.912-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Continue with X
              </a>

              <button
                onClick={() => navigate('/playground/anaskhan')}
                className="w-full mt-3 border border-border-subtle text-slate-300 py-3 rounded-xl text-sm hover:bg-white/5 transition-colors"
              >
                Try playground demo (@anaskhan)
              </button>
            </div>

            {/* Pricing section */}
            <div className="glass rounded-3xl p-6 lg:p-7 border border-white/10 w-full max-w-4xl">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-2xl font-bold">Pricing</h2>
                <span className="text-[11px] uppercase tracking-wide px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                  Live
                </span>
              </div>
              <p className="text-slate-300 text-sm mt-2">
                One-time payment, priced based on your audience size. Connect with X to see your exact price.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                {pricingTiers.map((tier) => (
                  <div key={tier.range} className="rounded-xl bg-bg-card/70 border border-border-subtle px-3 py-3">
                    <p className="text-[11px] text-slate-500">{tier.range}</p>
                    <p className="text-sm font-semibold text-slate-100 mt-1">{tier.price}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs text-slate-500 mt-4">
                One-time payment · lifetime access · no subscription
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
