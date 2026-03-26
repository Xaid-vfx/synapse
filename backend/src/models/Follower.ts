import mongoose, { Schema, Document } from 'mongoose';

export interface IActivityMetrics {
  tweetFrequency30d: number;
  avgLikes: number;
  avgRetweets: number;
  avgReplies: number;
}

export interface ICredibilityMetrics {
  followersCount: number;
  followingCount: number;
  ffRatio: number;
  accountAgeDays: number;
  isVerifiedLike: boolean;
}

export interface ISemantic {
  embedding: number[] | null;
  embeddingModel: string | null;
  embeddedAt: Date | null;
  embeddingVersion: string | null;
  vectorId: string | null;
}

export interface IEnrichmentState {
  status: 'pending' | 'running' | 'done' | 'failed';
  attempts: number;
  lastError: string | null;
  enrichedAt: Date | null;
}

export interface IFollower extends Document {
  userId: string;
  type: 'all' | 'verified';
  followerId: string;
  name: string;
  screen_name: string;
  profile_image_url: string | null;
  description: string | null;
  location: string | null;
  followers_count: number;
  following_count: number;
  tweet_count: number;
  is_blue_verified: boolean;
  verified: boolean;
  banner_url: string | null;
  created_at: string | null;
  fetchedAt: Date;

  // V3 enrichment fields
  searchDocument: string | null;
  topicTags: string[];
  activityMetrics: IActivityMetrics | null;
  credibilityMetrics: ICredibilityMetrics | null;
  reputationScore: number | null;
  semantic: ISemantic;
  enrichment: IEnrichmentState;
}

const FollowerSchema = new Schema<IFollower>(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ['all', 'verified'], required: true },
    followerId: { type: String, required: true },
    name: { type: String, required: true },
    screen_name: { type: String, default: '' },
    profile_image_url: { type: String, default: null },
    description: { type: String, default: null },
    location: { type: String, default: null },
    followers_count: { type: Number, default: 0 },
    following_count: { type: Number, default: 0 },
    tweet_count: { type: Number, default: 0 },
    is_blue_verified: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    banner_url: { type: String, default: null },
    created_at: { type: String, default: null },
    fetchedAt: { type: Date, default: Date.now },

    // V3 enrichment fields
    searchDocument: { type: String, default: null },
    topicTags: { type: [String], default: [] },
    activityMetrics: {
      type: new Schema(
        {
          tweetFrequency30d: { type: Number, default: 0 },
          avgLikes: { type: Number, default: 0 },
          avgRetweets: { type: Number, default: 0 },
          avgReplies: { type: Number, default: 0 },
        },
        { _id: false }
      ),
      default: null,
    },
    credibilityMetrics: {
      type: new Schema(
        {
          followersCount: { type: Number, default: 0 },
          followingCount: { type: Number, default: 0 },
          ffRatio: { type: Number, default: 0 },
          accountAgeDays: { type: Number, default: 0 },
          isVerifiedLike: { type: Boolean, default: false },
        },
        { _id: false }
      ),
      default: null,
    },
    reputationScore: { type: Number, default: null },
    semantic: {
      type: new Schema(
        {
          embedding: { type: [Number], default: null },
          embeddingModel: { type: String, default: null },
          embeddedAt: { type: Date, default: null },
          embeddingVersion: { type: String, default: null },
          vectorId: { type: String, default: null },
        },
        { _id: false }
      ),
      default: () => ({
        embedding: null,
        embeddingModel: null,
        embeddedAt: null,
        embeddingVersion: null,
        vectorId: null,
      }),
    },
    enrichment: {
      type: new Schema(
        {
          status: {
            type: String,
            enum: ['pending', 'running', 'done', 'failed'],
            default: 'pending',
          },
          attempts: { type: Number, default: 0 },
          lastError: { type: String, default: null },
          enrichedAt: { type: Date, default: null },
        },
        { _id: false }
      ),
      default: () => ({
        status: 'pending',
        attempts: 0,
        lastError: null,
        enrichedAt: null,
      }),
    },
  },
  { timestamps: true }
);

FollowerSchema.index({ userId: 1, type: 1 });
FollowerSchema.index({ userId: 1, type: 1, followerId: 1 }, { unique: true });
FollowerSchema.index({ userId: 1, 'enrichment.status': 1 });
FollowerSchema.index({ userId: 1, reputationScore: -1 });

export default mongoose.model<IFollower>('Follower', FollowerSchema);
