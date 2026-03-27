import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCheckoutSession, getBillingStatus, getMe } from '../lib/api';
import Seo from '../components/Seo';

const plans = [
  { id: 'starter_29', name: 'Starter', price: '$29', range: 'Up to 10k followers' },
  { id: 'growth_49', name: 'Growth', price: '$49', range: '10k to 100k followers' },
  { id: 'scale_79', name: 'Scale', price: '$79', range: '100k+ followers' },
] as const;

export default function PricingPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [recommendedTier, setRecommendedTier] = useState<string>('growth_49');
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
        setRecommendedTier(status.recommendedTier);
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
      <div className="min-h-screen bg-bg-dark text-white px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-extrabold text-center">One-time pricing. No subscription.</h1>
          <p className="text-slate-400 text-center mt-3">
            We recommend a plan based on your audience size ({followersCount.toLocaleString()} followers).
          </p>

          <div className="grid sm:grid-cols-3 gap-4 mt-8">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`rounded-xl border p-5 ${
                  plan.id === recommendedTier ? 'border-primary bg-primary/5' : 'border-border-subtle bg-bg-card'
                }`}
              >
                <p className="text-sm text-slate-400">{plan.name}</p>
                <p className="text-3xl font-bold mt-2">{plan.price}</p>
                <p className="text-xs text-slate-400 mt-2">{plan.range}</p>
                {plan.id === recommendedTier && (
                  <p className="text-xs mt-3 text-primary font-semibold">Recommended for your profile</p>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-red-400 text-sm text-center mt-6">{error}</p>}

          <div className="flex justify-center mt-8">
            <button
              onClick={handleCheckout}
              disabled={startingCheckout}
              className="bg-primary text-bg-dark font-bold px-8 py-3 rounded-xl disabled:opacity-60"
            >
              {startingCheckout ? 'Redirecting to Stripe...' : 'Unlock My Follower Intelligence'}
            </button>
          </div>

          <p className="text-xs text-slate-500 text-center mt-4">
            Pricing scales with audience size because larger accounts require deeper processing.
          </p>
        </div>
      </div>
    </>
  );
}
