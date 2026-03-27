import { type ComponentType, useState } from 'react';
import {
  Users,
  FileText,
  MapPin,
  BadgeCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  TrendingUp,
  Clock,
  Target,
} from 'lucide-react';
import type { SearchResult } from '../types';

interface Props {
  result: SearchResult;
  rank: number;
}

interface MetricInfo {
  label: string;
  value: number;
  color: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function scoreColor(score: number): string {
  if (score >= 0.7) return 'text-emerald-400';
  if (score >= 0.4) return 'text-amber-400';
  return 'text-slate-400';
}

function scoreBg(score: number): string {
  if (score >= 0.7) return 'bg-emerald-400/10 border-emerald-400/20';
  if (score >= 0.4) return 'bg-amber-400/10 border-amber-400/20';
  return 'bg-slate-400/10 border-slate-400/20';
}

export default function SearchResultCard({ result, rank }: Props) {
  const [expanded, setExpanded] = useState(false);
  const twitterUrl = `https://twitter.com/${result.screen_name}`;
  const avatarUrl = result.profile_image_url?.replace('_normal', '_400x400') ?? null;
  const { scoreBreakdown } = result;
  const metricItems: MetricInfo[] = [
    {
      label: 'Semantic',
      value: scoreBreakdown.semantic,
      icon: Sparkles,
      color: 'text-violet-400',
      description: 'How strongly their bio/topics semantically match your query intent.',
    },
    {
      label: 'Reputation',
      value: scoreBreakdown.reputation,
      icon: TrendingUp,
      color: 'text-emerald-400',
      description: 'Authority/credibility signal from follower quality and profile strength.',
    },
    {
      label: 'Recency',
      value: scoreBreakdown.recency,
      icon: Clock,
      color: 'text-sky-400',
      description: 'Freshness signal favoring more recently active and relevant accounts.',
    },
    {
      label: 'Intent',
      value: scoreBreakdown.intentBoost,
      icon: Target,
      color: 'text-amber-400',
      description: 'Extra boost when explicit intent cues align with your search phrase.',
    },
  ];

  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors duration-200 group">
      {/* Rank + avatar + name */}
      <div className="flex items-start gap-3">
        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
          {rank}
        </div>

        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={result.name}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-bg-elevated group-hover:ring-primary/30 transition-all shrink-0"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                `https://ui-avatars.com/api/?name=${encodeURIComponent(result.name)}&background=162a30&color=0db9f2&size=44`;
            }}
          />
        ) : (
          <div className="w-11 h-11 rounded-full bg-bg-elevated flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {result.name.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <a
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-sm text-white hover:text-primary transition-colors truncate max-w-full"
            >
              {result.name}
            </a>
            {(result.is_blue_verified || result.verified) && (
              <BadgeCheck className="w-4 h-4 text-primary shrink-0" />
            )}
          </div>
          <p className="text-slate-400 text-xs">@{result.screen_name}</p>
        </div>

        {/* Score badge */}
        <div
          title="Final ranking score out of 100 after combining all matching signals."
          className={`px-2.5 py-1 rounded-lg border text-xs font-bold ${scoreBg(scoreBreakdown.finalScore)} ${scoreColor(scoreBreakdown.finalScore)}`}
        >
          {(scoreBreakdown.finalScore * 100).toFixed(0)}
        </div>
      </div>

      {/* Bio */}
      {result.description && (
        <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">
          {result.description}
        </p>
      )}

      {/* Topic chips */}
      {result.topicTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.topicTags.map((tag) => (
            <span
              key={tag}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                result.matchedTopics.includes(tag)
                  ? 'bg-primary/15 text-primary border border-primary/25'
                  : 'bg-bg-elevated text-slate-400 border border-border-subtle'
              }`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Location */}
      {result.location && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{result.location}</span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 pt-2 border-t border-white/5">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
          <Users className="w-3 h-3 text-primary/70" />
          <span className="font-semibold text-white">{formatCount(result.followers_count)}</span>
          <span>followers</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400 min-w-0">
          <FileText className="w-3 h-3 text-primary/70" />
          <span className="font-semibold text-white">{formatCount(result.tweet_count)}</span>
          <span>tweets</span>
        </div>
        {result.reputationScore > 0 && (
          <div
            title="Profile reputation signal used as part of ranking."
            className="ml-auto flex items-center gap-1 text-xs text-slate-400 shrink-0"
          >
            <TrendingUp className="w-3 h-3 text-emerald-400/70" />
            <span className="font-semibold text-emerald-400">{result.reputationScore}</span>
            <span>rep</span>
          </div>
        )}
      </div>

      {/* Expand toggle for score breakdown */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition-colors w-fit"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {expanded ? 'Hide details' : 'Why this match?'}
      </button>

      {expanded && (
        <div className="space-y-3 pt-1 animate-in fade-in duration-200">
          <p className="text-[11px] text-slate-500">
            Hover each score to see what it means.
          </p>
          {/* Score breakdown */}
          <div className="grid grid-cols-2 gap-2">
            {metricItems.map(({ label, value, icon: Icon, color, description }) => (
              <div
                key={label}
                title={description}
                className="flex items-center gap-2 bg-bg-elevated/50 rounded-lg px-2.5 py-1.5 min-w-0"
              >
                <Icon className={`w-3 h-3 ${color}`} />
                <span className="text-[11px] text-slate-400">{label}</span>
                <span className="text-[11px] font-semibold text-white ml-auto">
                  {(value * 100).toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          {/* Supporting snippets */}
          {result.topSupportingSnippets.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                Supporting evidence
              </p>
              {result.topSupportingSnippets.map((snippet, i) => (
                <p
                  key={i}
                  className="text-xs text-slate-400 bg-bg-elevated/30 rounded px-2.5 py-1.5 leading-relaxed"
                >
                  &ldquo;{snippet}&rdquo;
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
