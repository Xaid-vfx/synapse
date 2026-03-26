export interface AuthUser {
  id: string;
  name: string;
  username: string;
  profileImageUrl?: string;
  description?: string;
  publicMetrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
  };
}

export interface TwitterFollower {
  id: string;
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
}

export interface FollowersApiResponse {
  followers: TwitterFollower[];
  next_cursor: string | null;
}

export type FollowersTab = 'all' | 'verified';
