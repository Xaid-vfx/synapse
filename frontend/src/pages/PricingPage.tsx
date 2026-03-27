import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCheckoutSession, getBillingStatus, getMe } from '../lib/api';
import Seo from '../components/Seo';

export default function PricingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [price, setPrice] = useState<number>(29);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await getMe();
        const status = await getBillingStatus();
        if (status.hasPaidAccess) {
          navigate('/dashboard', { replace: true });
          return;
        }
        setPrice(status.price);
        setFollowersCount(status.followersCount);
      } catch {
        navigate('/', { replace: true });
        return;
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleCheckout = async () => {
    try {
      setStartingCheckout(true);
      setError(null);
      const result = await createCheckoutSession();
      if (result.redirectTo) {
        window.location.href = result.redirectTo;
        return;
      }
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setError('Unable to start checkout. Please try again.');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Unable to start checkout');
    } finally {
      setStartingCheckout(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-bg-dark" />;

  return (
    <>
      <Seo title="Synapse — Pricing" description="One-time pricing based on follower size." />
      <div className="min-h-screen bg-bg-dark text-white flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center">

          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-bg-dark" aria-hidden="true">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <span className="text-2xl font-black tracking-tight">Synapse</span>
          </div>

          <h1 className="text-3xl font-extrabold">Unlock your follower intelligence</h1>
          <p className="text-slate-400 mt-3 text-sm">
            One-time payment — priced based on your audience size.
          </p>

          {/* Price card */}
          <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-8">
            <p className="text-slate-400 text-sm">
              {followersCount > 0
                ? `Based on your ${followersCount.toLocaleString()} followers`
                : 'Your price'}
            </p>
            <p className="text-6xl font-black mt-2">
              ${price.toFixed(2)}
            </p>
            <p className="text-slate-500 text-xs mt-2">USD · one-time · lifetime access</p>

            <ul className="mt-6 space-y-2 text-sm text-left text-slate-300">
              {[
                'Full follower intelligence dashboard',
                'AI-scored follower profiles',
                'Search & filter by niche, role, location',
                'Lifetime access — no subscription',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="text-primary">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>

          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

          <button
            onClick={handleCheckout}
            disabled={startingCheckout}
            className="w-full mt-6 bg-primary text-bg-dark font-bold py-3 rounded-xl disabled:opacity-60"
          >
            {startingCheckout ? 'Redirecting...' : `Pay $${price.toFixed(2)} — Unlock Access`}
          </button>

          <p className="text-xs text-slate-600 mt-4">
            Price scales with audience size. Larger accounts require deeper processing.
          </p>
        </div>
      </div>
    </>
  );
}
