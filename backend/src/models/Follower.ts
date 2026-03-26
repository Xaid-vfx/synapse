import mongoose, { Schema, Document } from 'mongoose';

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
  fetchedAt: Date;
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
    fetchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

FollowerSchema.index({ userId: 1, type: 1 });
FollowerSchema.index({ userId: 1, type: 1, followerId: 1 }, { unique: true });

export default mongoose.model<IFollower>('Follower', FollowerSchema);
