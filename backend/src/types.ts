import 'express-session';

declare module 'express-session' {
  interface SessionData {
    user?: {
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
    };
    accessToken?: string;
    refreshToken?: string;
    codeVerifier?: string;
    state?: string;
    adminAuthenticated?: boolean;
  }
}

export interface TwitterFollower {
  id: string | number;
  id_str?: string;
  name: string;
  screen_name: string;
  profile_image_url_https?: string;
  profile_image_url?: string;
  followers_count?: number;
  friends_count?: number;
  verified?: boolean;
  description?: string;
  statuses_count?: number;
  created_at?: string;
  location?: string;
}

export interface FollowersResponse {
  users?: TwitterFollower[];
  data?: TwitterFollower[];
  next_cursor?: number | string;
  next_cursor_str?: string;
  meta?: {
    next_cursor?: string;
    result_count?: number;
  };
}
