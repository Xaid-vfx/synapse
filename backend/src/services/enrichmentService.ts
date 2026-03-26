import Follower from '../models/Follower';
import EnrichmentJob from '../models/EnrichmentJob';
import { fetchUserTweets } from './rapidApiService';
import { buildSearchDocument } from './searchDocumentService';
import {
  computeReputationScore,
  computeActivityMetrics,
} from './reputationService';
import { generateEmbeddings } from './embeddingService';
import { ENRICHMENT_CONFIG } from '../config/enrichment';

// In-memory flag to prevent duplicate triggers within a single process
const activeJobs = new Map<string, boolean>();

// ---------------------------------------------------------------------------
// Concurrency-limited executor
// ---------------------------------------------------------------------------
class Semaphore {
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(private limit: number) {}

  async acquire(): Promise<void> {
    if (this.running < this.limit) {
      this.running++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.running++;
        resolve();
      });
    });
  }

  release() {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}

// ---------------------------------------------------------------------------
// Public: trigger enrichment for a user
// ---------------------------------------------------------------------------
export async function triggerEnrichment(
  userId: string,
): Promise<{ jobId: string; message: string }> {
  if (activeJobs.get(userId)) {
    const existing = await EnrichmentJob.findOne({
      userId,
      status: 'running',
    });
    return {
      jobId: existing?._id?.toString() ?? '',
      message: 'Enrichment already running for this user',
    };
  }

  const now = new Date();

  // If there's a running job whose lock hasn't expired, skip
  const running = await EnrichmentJob.findOne({
    userId,
    status: 'running',
    lockedUntil: { $gt: now },
  });
  if (running) {
    return {
      jobId: running._id.toString(),
      message: 'Enrichment already running for this user',
    };
  }

  // Expire stale running jobs
  await EnrichmentJob.updateMany(
    { userId, status: 'running', lockedUntil: { $lt: now } },
    { $set: { status: 'failed', error: 'Stale lock expired' } },
  );

  const totalFollowers = await Follower.countDocuments({
    userId,
    type: 'all',
  });

  // Mark un-enriched / retryable followers as pending
  await Follower.updateMany(
    {
      userId,
      type: 'all',
      $or: [
        { 'enrichment.status': { $exists: false } },
        { 'enrichment.status': null },
        { 'enrichment.status': 'pending' },
        {
          'enrichment.status': 'failed',
          'enrichment.attempts': {
            $lt: ENRICHMENT_CONFIG.MAX_RETRY_ATTEMPTS,
          },
        },
      ],
    },
    { $set: { 'enrichment.status': 'pending' } },
  );

  const job = await EnrichmentJob.create({
    userId,
    status: 'running',
    totalFollowers,
    startedAt: now,
    lastHeartbeat: now,
    lockedUntil: new Date(now.getTime() + ENRICHMENT_CONFIG.JOB_LOCK_TTL_MS),
  });

  activeJobs.set(userId, true);
  console.log(
    `[EnrichmentPipeline] Triggered | userId=${userId} jobId=${job._id.toString()} totalFollowers=${totalFollowers}`,
  );

  // Fire-and-forget background processing
  runPipeline(userId, job._id.toString()).catch((err) => {
    console.error(`[Enrichment] Fatal error for user ${userId}:`, err);
  });

  return {
    jobId: job._id.toString(),
    message: `Enrichment started for ${totalFollowers} followers`,
  };
}

// ---------------------------------------------------------------------------
// Core pipeline loop
// ---------------------------------------------------------------------------
async function runPipeline(userId: string, jobId: string): Promise<void> {
  // Heartbeat keeps the lock alive
  const heartbeat = setInterval(async () => {
    try {
      await EnrichmentJob.updateOne(
        { _id: jobId },
        {
          $set: {
            lastHeartbeat: new Date(),
            lockedUntil: new Date(
              Date.now() + ENRICHMENT_CONFIG.JOB_LOCK_TTL_MS,
            ),
          },
        },
      );
    } catch {}
  }, ENRICHMENT_CONFIG.JOB_HEARTBEAT_MS);

  let totalEnriched = 0;
  let totalFailed = 0;

  try {
    console.log(`[EnrichmentPipeline] Start | userId=${userId} jobId=${jobId}`);
    // Phase 1 — process pending followers
    const p1 = await drainQueue(userId, jobId, ['pending', null]);
    totalEnriched += p1.enriched;
    totalFailed += p1.failed;

    // Phase 2 — retry previously failed (under threshold)
    const p2 = await drainQueue(userId, jobId, ['failed']);
    totalEnriched += p2.enriched;
    totalFailed += p2.failed;

    await EnrichmentJob.updateOne(
      { _id: jobId },
      {
        $set: {
          status: 'completed',
          enrichedCount: totalEnriched,
          failedCount: totalFailed,
          completedAt: new Date(),
        },
      },
    );
    console.log(
      `[EnrichmentPipeline] Complete | userId=${userId} jobId=${jobId} enriched=${totalEnriched} failed=${totalFailed}`,
    );
  } catch (err: any) {
    console.error(`[Enrichment] Job ${jobId} failed:`, err);
    await EnrichmentJob.updateOne(
      { _id: jobId },
      {
        $set: {
          status: 'failed',
          error: err.message?.slice(0, 500),
          completedAt: new Date(),
        },
      },
    );
  } finally {
    clearInterval(heartbeat);
    activeJobs.delete(userId);
  }
}

// ---------------------------------------------------------------------------
// Drain: process followers matching given enrichment statuses in batches
// ---------------------------------------------------------------------------
async function drainQueue(
  userId: string,
  jobId: string,
  statuses: Array<string | null>,
): Promise<{ enriched: number; failed: number }> {
  let enriched = 0;
  let failed = 0;

  const phaseName = statuses.includes('failed') ? 'retry-failed' : 'pending';
  while (true) {
    const filter: any = {
      userId,
      type: 'all',
      'enrichment.status': { $in: statuses },
    };

    // For 'failed' status, only retry under threshold
    if (statuses.includes('failed')) {
      filter['enrichment.attempts'] = {
        $lt: ENRICHMENT_CONFIG.MAX_RETRY_ATTEMPTS,
      };
    }

    const batch = await Follower.find(filter)
      .sort({ _id: 1 })
      .limit(ENRICHMENT_CONFIG.BATCH_SIZE)
      .lean();

    if (batch.length === 0) break;
    console.log(
      `[EnrichmentPipeline] Batch start | userId=${userId} jobId=${jobId} phase=${phaseName} batchSize=${batch.length} runningTotals=enriched:${enriched},failed:${failed}`,
    );

    const result = await processBatch(batch);
    enriched += result.enriched;
    failed += result.failed;
    console.log(
      `[EnrichmentPipeline] Batch done | userId=${userId} jobId=${jobId} phase=${phaseName} batchEnriched=${result.enriched} batchFailed=${result.failed} runningTotals=enriched:${enriched},failed:${failed}`,
    );

    // Checkpoint progress
    await EnrichmentJob.updateOne(
      { _id: jobId },
      {
        $set: {
          enrichedCount: enriched,
          failedCount: failed,
          lastHeartbeat: new Date(),
          lastCheckpointFollowerId: batch[batch.length - 1].followerId,
          lockedUntil: new Date(
            Date.now() + ENRICHMENT_CONFIG.JOB_LOCK_TTL_MS,
          ),
        },
      },
    );
  }

  return { enriched, failed };
}

// ---------------------------------------------------------------------------
// Process a single batch: fetch tweets → build docs → embed → persist
// ---------------------------------------------------------------------------
interface PreparedFollower {
  _id: any;
  followerId: string;
  searchDocument: string;
  topicTags: string[];
  activityMetrics: any;
  credibilityMetrics: any;
  reputationScore: number;
}

async function processBatch(
  batch: any[],
): Promise<{ enriched: number; failed: number }> {
  const prepared: PreparedFollower[] = [];
  let failed = 0;
  const sem = new Semaphore(ENRICHMENT_CONFIG.CONCURRENCY_PER_USER);

  // Step 1: fetch tweets + build enrichment data (concurrency-limited)
  await Promise.all(
    batch.map(async (follower) => {
      await sem.acquire();
      try {
        const data = await prepareFollower(follower);
        if (data) prepared.push(data);
      } catch {
        failed++;
      } finally {
        sem.release();
      }
    }),
  );

  if (prepared.length === 0) return { enriched: 0, failed };

  // Step 2: batch-embed all search documents
  try {
    const embeddings = await generateEmbeddings(
      prepared.map((p) => p.searchDocument),
    );

    // Step 3: bulk-write everything back
    await Follower.bulkWrite(
      prepared.map((p, i) => ({
        updateOne: {
          filter: { _id: p._id },
          update: {
            $set: {
              searchDocument: p.searchDocument,
              topicTags: p.topicTags,
              activityMetrics: p.activityMetrics,
              credibilityMetrics: p.credibilityMetrics,
              reputationScore: p.reputationScore,
              'semantic.embedding': embeddings[i],
              'semantic.embeddingModel': ENRICHMENT_CONFIG.EMBEDDING_MODEL,
              'semantic.embeddedAt': new Date(),
              'semantic.embeddingVersion': ENRICHMENT_CONFIG.EMBEDDING_VERSION,
              'enrichment.status': 'done',
              'enrichment.enrichedAt': new Date(),
            },
          },
        },
      })),
      { ordered: false },
    );

    return { enriched: prepared.length, failed };
  } catch (err: any) {
    console.error('[Enrichment] Batch embedding/write failed:', err.message);

    // Save non-embedding data and mark as failed
    for (const p of prepared) {
      await Follower.updateOne(
        { _id: p._id },
        {
          $set: {
            searchDocument: p.searchDocument,
            topicTags: p.topicTags,
            activityMetrics: p.activityMetrics,
            credibilityMetrics: p.credibilityMetrics,
            reputationScore: p.reputationScore,
            'enrichment.status': 'failed',
            'enrichment.lastError': 'Embedding generation failed',
          },
          $inc: { 'enrichment.attempts': 1 },
        },
      );
    }
    return { enriched: 0, failed: failed + prepared.length };
  }
}

// ---------------------------------------------------------------------------
// Prepare a single follower's enrichment data (no embedding yet)
// ---------------------------------------------------------------------------
async function prepareFollower(
  follower: any,
): Promise<PreparedFollower | null> {
  try {
    await Follower.updateOne(
      { _id: follower._id },
      { $set: { 'enrichment.status': 'running' } },
    );

    // Fetch tweets — gracefully degrade to empty if RapidAPI fails
    let tweets: any[] = [];
    try {
      tweets = await fetchUserTweets(follower.followerId, 20);
    } catch (err: any) {
      console.warn(
        `[Enrichment] Tweet fetch failed for ${follower.followerId}: ${err.message}`,
      );
    }

    const doc = buildSearchDocument({
      name: follower.name,
      screenName: follower.screen_name,
      description: follower.description,
      location: follower.location,
      tweets,
    });

    const activity = computeActivityMetrics(tweets);

    const ffRatio =
      follower.following_count > 0
        ? follower.followers_count / follower.following_count
        : follower.followers_count > 0
          ? 100
          : 0;

    const accountAgeDays = follower.created_at
      ? Math.floor(
          (Date.now() - new Date(follower.created_at).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 365;

    const credibility = {
      followersCount: follower.followers_count,
      followingCount: follower.following_count,
      ffRatio: Math.round(ffRatio * 100) / 100,
      accountAgeDays,
      isVerifiedLike: follower.is_blue_verified || follower.verified,
    };

    const { score } = computeReputationScore({ ...credibility, ...activity });

    return {
      _id: follower._id,
      followerId: follower.followerId,
      searchDocument: doc.searchDocument,
      topicTags: doc.topicTags,
      activityMetrics: activity,
      credibilityMetrics: credibility,
      reputationScore: score,
    };
  } catch (err: any) {
    console.error(
      `[Enrichment] prepareFollower failed for ${follower.followerId}:`,
      err.message,
    );
    await Follower.updateOne(
      { _id: follower._id },
      {
        $set: {
          'enrichment.status': 'failed',
          'enrichment.lastError': err.message?.slice(0, 500),
        },
        $inc: { 'enrichment.attempts': 1 },
      },
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Status / progress queries
// ---------------------------------------------------------------------------
export async function getEnrichmentStatus(userId: string) {
  const job = await EnrichmentJob.findOne({ userId })
    .sort({ createdAt: -1 })
    .lean();

  const pipeline = await Follower.aggregate([
    { $match: { userId, type: 'all' } },
    { $group: { _id: '$enrichment.status', count: { $sum: 1 } } },
  ]);

  const counts: Record<string, number> = {};
  for (const row of pipeline) counts[row._id ?? 'none'] = row.count;

  return {
    job: job
      ? {
          id: job._id,
          status: job.status,
          totalFollowers: job.totalFollowers,
          enrichedCount: job.enrichedCount,
          failedCount: job.failedCount,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
        }
      : null,
    followerCounts: {
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      done: counts['done'] ?? 0,
      pending:
        (counts['pending'] ?? 0) + (counts['none'] ?? 0) + (counts['null'] ?? 0),
      running: counts['running'] ?? 0,
      failed: counts['failed'] ?? 0,
    },
  };
}

export async function getEnrichmentProgress(userId: string) {
  const total = await Follower.countDocuments({ userId, type: 'all' });
  const done = await Follower.countDocuments({
    userId,
    type: 'all',
    'enrichment.status': 'done',
  });
  const failed = await Follower.countDocuments({
    userId,
    type: 'all',
    'enrichment.status': 'failed',
  });
  const running = await Follower.countDocuments({
    userId,
    type: 'all',
    'enrichment.status': 'running',
  });

  return {
    total,
    done,
    failed,
    running,
    pending: total - done - failed - running,
    percentComplete: total > 0 ? Math.round((done / total) * 100) : 0,
  };
}

export async function retryFailedEnrichment(
  userId: string,
): Promise<{ count: number; message: string }> {
  const result = await Follower.updateMany(
    {
      userId,
      type: 'all',
      'enrichment.status': 'failed',
      'enrichment.attempts': { $lt: ENRICHMENT_CONFIG.DEAD_LETTER_THRESHOLD },
    },
    { $set: { 'enrichment.status': 'pending' } },
  );

  if (result.modifiedCount > 0) {
    await triggerEnrichment(userId);
    return {
      count: result.modifiedCount,
      message: `Reset ${result.modifiedCount} failed followers — re-enrichment triggered`,
    };
  }

  return { count: 0, message: 'No failed followers eligible for retry' };
}
