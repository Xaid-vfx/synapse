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
      <div className="min-h-screen bg-bg-dark px-4 py-10 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className="bg-primary p-2.5 rounded-xl">
              <BarChart3 className="w-6 h-6 text-bg-dark" strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">Synapse</span>
          </div>

          <div className="grid lg:grid-cols-5 gap-6 items-start">
            {/* Main card */}
            <div className="glass rounded-2xl p-8 glow-primary lg:col-span-2">
              <h1 className="text-2xl font-bold text-center mb-2">Analyze Your Audience</h1>
              <p className="text-slate-400 text-center text-sm mb-8 leading-relaxed">
                Connecting with Twitter is coming soon. Join early access to get notified first.
              </p>

              {error && (
                <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl px-4 py-3 mb-6 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

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
                className="w-full mt-4 border border-border-subtle text-slate-300 py-3 rounded-xl text-sm hover:bg-white/5 transition-colors"
              >
                Try playground demo (@anaskhan)
              </button>
            </div>

            {/* Pricing section on landing */}
            <div className="glass rounded-2xl p-6 lg:col-span-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold">Pricing</h2>
                <span className="text-[11px] uppercase tracking-wide px-2 py-1 rounded-md bg-primary/15 text-primary border border-primary/25">
                  Coming soon
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-2">
                One-time pricing based on audience size. Final checkout flow is coming soon.
              </p>
              <div className="grid sm:grid-cols-3 gap-3 mt-5">
                {plans.map((plan) => (
                  <div key={plan.id} className="rounded-xl border border-border-subtle bg-bg-card p-4">
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
            <div className="glass w-full max-w-md rounded-2xl p-6 border border-border-subtle">
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
