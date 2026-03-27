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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI!,
    collectionName: 'sessions',
    ttl: 30 * 24 * 60 * 60, // 30 days
  }),
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
