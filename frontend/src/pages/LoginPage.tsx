import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Zap, BarChart3, AlertCircle, X } from 'lucide-react';
import { getMe, submitEarlyAccessEmail } from '../lib/api';
import Seo from '../components/Seo';

const LOGIN_SEO_DESC =
  'Synapse follower intelligence is launching soon. Join early access and preview pricing.';

const plans = [
  { id: 'starter_29', name: 'Starter', price: '$29', range: 'Up to 10k followers' },
  { id: 'growth_49', name: 'Growth', price: '$49', range: '10k to 100k followers' },
  { id: 'scale_79', name: 'Scale', price: '$79', range: '100k+ followers' },
] as const;

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEarlyAccessModal, setShowEarlyAccessModal] = useState(false);
  const [email, setEmail] = useState('');
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

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

    // Keep "/" as a real landing page for non-paid users.
    getMe()
      .then((user) => {
        if (user.hasPaidAccess || user.hasWhitelistedAccess) {
          navigate('/dashboard', { replace: true });
          return;
        }
        setChecking(false);
      })
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

  const handleSubmitEarlyAccess = async () => {
    if (!email.trim() || submittingEmail) return;
    setEmailError(null);
    setEmailSuccess(null);
    setSubmittingEmail(true);
    try {
      await submitEarlyAccessEmail(email.trim(), 'landing-modal');
      setEmailSuccess('You are on the list. We will reach out soon.');
      setEmail('');
    } catch (err: any) {
      setEmailError(err?.response?.data?.error || 'Could not save your email');
    } finally {
      setSubmittingEmail(false);
    }
  };

  return (
    <>
      <Seo title="Synapse — Coming soon" description={LOGIN_SEO_DESC} />
      <div className="min-h-screen bg-bg-dark px-4 py-10 sm:py-14 relative overflow-hidden">
        {/* Background glow layers */}
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
            Follower intelligence for creators and operators. Public playground is live, full account connection is almost here.
          </p>

          <div className="mt-8 flex flex-col items-center gap-6">
            {/* Main card */}
            <div className="glass rounded-3xl p-7 sm:p-8 glow-primary border border-primary/20 shadow-[0_20px_90px_rgba(13,185,242,0.14)] w-full max-w-xl">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wide px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/25">
                Private beta
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mt-4 leading-tight">Analyze Your Audience</h1>
              <p className="text-slate-300 text-sm mt-3 mb-6 leading-relaxed">
                Connecting with Twitter is coming soon. Join early access to get notified first.
              </p>

              {error && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 mb-6 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-3 mb-7">
                {[
                  { icon: Users, label: 'View all your followers' },
                  { icon: Zap, label: 'Identify verified accounts' },
                  { icon: BarChart3, label: 'Score and analyze each follower' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3 text-sm text-slate-200">
                    <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    {label}
                  </div>
                ))}
              </div>

              <button
                disabled
                className="flex items-center justify-center gap-3 w-full bg-white/10 text-slate-300 font-bold py-3.5 px-6 rounded-xl text-sm cursor-not-allowed border border-white/10"
              >
                Continue with X (Coming soon)
              </button>

              <button
                onClick={() => {
                  setShowEarlyAccessModal(true);
                  setEmailError(null);
                  setEmailSuccess(null);
                }}
                className="w-full mt-3 bg-primary text-bg-dark font-bold py-3 rounded-xl text-sm hover:opacity-95 transition-opacity"
              >
                Join early access
              </button>

              <button
                onClick={() => navigate('/playground/anaskhan')}
                className="w-full mt-3 border border-border-subtle text-slate-300 py-3 rounded-xl text-sm hover:bg-white/5 transition-colors"
              >
                Try playground demo (@anaskhan)
              </button>
            </div>

            {/* Pricing section on landing */}
            <div className="glass rounded-3xl p-6 lg:p-7 border border-white/10 w-full max-w-4xl">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-2xl font-bold">Pricing</h2>
                <span className="text-[11px] uppercase tracking-wide px-2 py-1 rounded-md bg-primary/15 text-primary border border-primary/25">
                  Coming soon
                </span>
              </div>
              <p className="text-slate-300 text-sm mt-2">
                One-time pricing based on audience size. Final checkout flow is coming soon.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                {[
                  { label: 'Waitlist', value: 'Open' },
                  { label: 'Demo', value: 'Live' },
                  { label: 'Checkout', value: 'Soon' },
                  { label: 'Support', value: 'Priority' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-bg-card/70 border border-border-subtle px-3 py-2">
                    <p className="text-[11px] text-slate-500">{item.label}</p>
                    <p className="text-sm font-semibold text-slate-100 mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-3 gap-3 mt-5">
                {plans.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-2xl border border-border-subtle bg-bg-card p-4 hover:border-primary/30 hover:bg-bg-card/80 transition-all"
                  >
                    <p className="text-sm text-slate-300 font-semibold">{plan.name}</p>
                    <p className="text-2xl font-bold mt-1">{plan.price}</p>
                    <p className="text-xs text-slate-500 mt-2">{plan.range}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-4">Early access users will be notified as soon as this launches.</p>
            </div>
          </div>
        </div>

        {showEarlyAccessModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
            <div className="glass w-full max-w-md rounded-2xl p-6 border border-border-subtle shadow-[0_18px_70px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Early access</h3>
                <button
                  onClick={() => setShowEarlyAccessModal(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-slate-400 mt-2">
                Drop your email and we will notify you when Twitter connection and checkout go live.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="mt-4 w-full h-11 bg-bg-card border border-border-subtle rounded-lg px-3 text-sm"
              />
              {emailError && <p className="text-red-400 text-xs mt-2">{emailError}</p>}
              {emailSuccess && <p className="text-emerald-400 text-xs mt-2">{emailSuccess}</p>}
              <button
                onClick={handleSubmitEarlyAccess}
                disabled={submittingEmail}
                className="mt-4 w-full bg-primary text-bg-dark font-bold h-11 rounded-lg disabled:opacity-60"
              >
                {submittingEmail ? 'Saving...' : 'Join waitlist'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
