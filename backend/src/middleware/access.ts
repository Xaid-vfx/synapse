import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import AccessGrant from '../models/AccessGrant';

export async function hasAccessForUsername(username?: string): Promise<boolean> {
  if (!username) return false;
  const usernameLower = username.toLowerCase();
  const grant = await AccessGrant.findOne({ usernameLower, active: true }).lean();
  return Boolean(grant);
}

export async function hasPaidOrWhitelistedAccess(twitterId: string, username?: string): Promise<boolean> {
  const user = await User.findOne({ twitterId }).lean();
  if (user?.hasPaidAccess) return true;
  return hasAccessForUsername(username);
}

export async function requirePaidAccess(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const allowed = await hasPaidOrWhitelistedAccess(req.session.user.id, req.session.user.username);
  if (!allowed) {
    return res.status(402).json({
      error: 'Payment required',
      code: 'PAYMENT_REQUIRED',
      message: 'Complete checkout to unlock full dashboard access.',
    });
  }

  next();
}

export function requireAdminSession(req: Request, res: Response, next: NextFunction) {
  if (!req.session.adminAuthenticated) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  next();
}
