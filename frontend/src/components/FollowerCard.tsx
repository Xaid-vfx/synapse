import { Users, FileText, MapPin, BadgeCheck } from 'lucide-react';
import type { TwitterFollower } from '../types';

interface Props {
  follower: TwitterFollower;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function FollowerCard({ follower }: Props) {
  const twitterUrl = `https://twitter.com/${follower.screen_name}`;
  // Upgrade _normal to _400x400 for better resolution
  const avatarUrl = follower.profile_image_url?.replace('_normal', '_400x400') ?? null;

  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors duration-200 group">
      {/* Header: avatar + name */}
      <div className="flex items-start gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={follower.name}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-bg-elevated group-hover:ring-primary/30 transition-all shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                `https://ui-avatars.com/api/?name=${encodeURIComponent(follower.name)}&background=162a30&color=0db9f2&size=44`;
            }}
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-bg-elevated flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {follower.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-sm text-white hover:text-primary transition-colors truncate"
            >
              {follower.name}
            </a>
            {(follower.is_blue_verified || follower.verified) && (
              <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
            )}
          </div>
          <p className="text-slate-400 text-xs">@{follower.screen_name}</p>
        </div>
      </div>

      {/* Bio */}
      {follower.description && (
        <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">
          {follower.description}
        </p>
      )}

      {/* Location */}
      {follower.location && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{follower.location}</span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 mt-auto pt-2 border-t border-white/5">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Users className="w-3 h-3 text-primary/70" />
          <span className="font-semibold text-white">{formatCount(follower.followers_count)}</span>
          <span>followers</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <FileText className="w-3 h-3 text-primary/70" />
          <span className="font-semibold text-white">{formatCount(follower.tweet_count)}</span>
          <span>tweets</span>
        </div>
      </div>
    </div>
  );
}
