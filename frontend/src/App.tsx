import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import PricingPage from './pages/PricingPage';
import BillingSuccessPage from './pages/BillingSuccessPage';
import AdminWhitelistPage from './pages/AdminWhitelistPage';
import PlaygroundPage from './pages/PlaygroundPage';
import DemoPage from './pages/DemoPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/billing/success" element={<BillingSuccessPage />} />
        <Route path="/admin/whitelist" element={<AdminWhitelistPage />} />
        <Route path="/playground" element={<PlaygroundPage />} />
        <Route path="/playground/:username" element={<PlaygroundPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
