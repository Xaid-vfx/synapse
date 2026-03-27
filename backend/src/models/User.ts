import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  twitterId: string;
  name: string;
  username: string;
  profileImageUrl?: string;
  description?: string;
  publicMetrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
  };
  accessToken?: string;
  refreshToken?: string;
  hasPaidAccess?: boolean;
  paidAt?: Date;
  paidPlanTier?: 'starter_29' | 'growth_49' | 'scale_79';
  polarCustomerId?: string;
  polarCheckoutId?: string;
  polarOrderId?: string;
  lastFollowersFetchAt?: Date;
  lastVerifiedFetchAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    twitterId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    username: { type: String, required: true },
    profileImageUrl: String,
    description: String,
    publicMetrics: {
      followers_count: Number,
      following_count: Number,
      tweet_count: Number,
    },
    accessToken: String,
    refreshToken: String,
    hasPaidAccess: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
    paidPlanTier: {
      type: String,
      enum: ['starter_29', 'growth_49', 'scale_79'],
      default: null,
    },
    polarCustomerId: { type: String, default: null },
    polarCheckoutId: { type: String, default: null },
    polarOrderId: { type: String, default: null },
    lastFollowersFetchAt: Date,
    lastVerifiedFetchAt: Date,
  },
  { timestamps: true }
);

export default mongoose.model<IUser>('User', UserSchema);
