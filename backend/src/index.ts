import './types';
import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db';
import authRouter from './routes/auth';
import followersRouter from './routes/followers';
import searchRouter from './routes/search';
import enrichmentRouter from './routes/enrichment';
import billingRouter from './routes/billing';
import adminRouter from './routes/admin';
import playgroundRouter from './routes/playground';
import earlyAccessRouter from './routes/earlyAccess';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Cloud Run / load balancers: required for correct req.secure and cookies behind HTTPS
app.set('trust proxy', 1);

const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

app.use(cors({
  origin: frontendOrigin,
  credentials: true,
}));

// Stripe webhook signature verification requires raw body.
app.use('/api/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

const mongoUrl = process.env.MONGODB_URI;
if (!mongoUrl && process.env.NODE_ENV === 'production') {
  console.warn(
    '⚠️ MONGODB_URI is not set; using in-memory sessions until it is configured in Cloud Run.',
  );
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: mongoUrl
    ? MongoStore.create({
        mongoUrl,
        collectionName: 'sessions',
        ttl: 30 * 24 * 60 * 60, // 30 days
      })
    : undefined,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

app.use('/auth', authRouter);
app.use('/api', followersRouter);
app.use('/api', searchRouter);
app.use('/api', enrichmentRouter);
app.use('/api', billingRouter);
app.use('/api', adminRouter);
app.use('/api', playgroundRouter);
app.use('/api', earlyAccessRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  // Listen before MongoDB: Cloud Run requires the process to bind to $PORT quickly.
  // If we await connectDB() first, a slow or unreachable Atlas cluster can block startup and fail deployment.
  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`✅ Backend listening on port ${PORT}`);
  });
  await connectDB();
}

start();
