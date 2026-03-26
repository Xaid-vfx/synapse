import mongoose, { Schema, Document } from 'mongoose';

export interface IEnrichmentJob extends Document {
  userId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalFollowers: number;
  enrichedCount: number;
  failedCount: number;
  skippedCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  lastHeartbeat: Date | null;
  lastCheckpointFollowerId: string | null;
  error: string | null;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EnrichmentJobSchema = new Schema<IEnrichmentJob>(
  {
    userId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed', 'cancelled'],
      default: 'queued',
    },
    totalFollowers: { type: Number, default: 0 },
    enrichedCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    lastHeartbeat: { type: Date, default: null },
    lastCheckpointFollowerId: { type: String, default: null },
    error: { type: String, default: null },
    lockedUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

EnrichmentJobSchema.index({ userId: 1, status: 1 });
EnrichmentJobSchema.index({ userId: 1, lockedUntil: 1 });

export default mongoose.model<IEnrichmentJob>('EnrichmentJob', EnrichmentJobSchema);
