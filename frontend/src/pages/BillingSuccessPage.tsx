import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBillingStatus } from '../lib/api';

export default function BillingSuccessPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const status = await getBillingStatus();
        if (status.hasPaidAccess) {
          navigate('/dashboard', { replace: true });
          return;
        }
      } catch {
        // Ignore and keep user on this page.
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-bg-dark text-white flex items-center justify-center px-6">
      <div className="glass rounded-2xl p-8 max-w-md text-center">
        <h1 className="text-2xl font-bold">Payment received</h1>
        <p className="text-slate-400 mt-3 text-sm">
          We are confirming your access. You can head to your dashboard now.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="mt-6 bg-primary text-bg-dark font-bold px-6 py-2.5 rounded-lg"
        >
          Go to dashboard
        </button>
      </div>
    </div>
  );
}
