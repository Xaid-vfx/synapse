import { Router, Request, Response } from 'express';
import EarlyAccessLead from '../models/EarlyAccessLead';

const router = Router();

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

router.post('/early-access', async (req: Request, res: Response) => {
  const email = String(req.body?.email || '').trim();
  const source = String(req.body?.source || 'landing').trim() || 'landing';

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const emailLower = email.toLowerCase();

  await EarlyAccessLead.findOneAndUpdate(
    { emailLower },
    { email, emailLower, source },
    { upsert: true, new: true }
  );

  return res.json({ success: true });
});

export default router;
