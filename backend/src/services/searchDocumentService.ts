import type { RawTweet } from './rapidApiService';

// ---------------------------------------------------------------------------
// Topic keyword dictionary
// ---------------------------------------------------------------------------
const TOPIC_KEYWORDS: Record<string, string[]> = {
  backend: ['backend', 'server-side', 'api', 'database', 'sql', 'postgres', 'mysql', 'redis', 'node.js', 'express', 'django', 'flask', 'golang', 'rust lang', 'spring boot'],
  frontend: ['frontend', 'react', 'vue', 'angular', 'nextjs', 'svelte', 'css', 'tailwind', 'ui engineer'],
  founder: ['founder', 'co-founder', 'cofounder', 'ceo', 'building', 'bootstrapped', 'launched my'],
  AI: ['artificial intelligence', 'machine learning', ' ml ', ' ai ', 'deep learning', 'llm', ' gpt', 'transformer', 'neural net', 'nlp', 'computer vision'],
  VC: [' vc ', 'venture capital', 'investor', 'investing in', 'fund ', 'portfolio', 'seed stage', 'series a', 'series b', 'angel investor', 'general partner'],
  recruiter: ['recruiter', 'recruiting', 'talent acquisition', 'headhunt', "we're hiring", 'job opening', 'open role'],
  fintech: ['fintech', 'payments', 'banking', 'defi', 'financial tech', 'neobank', 'trading platform'],
  crypto: ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'web3', ' nft', ' token'],
  infra: ['infrastructure', 'devops', 'cloud', ' aws ', ' gcp ', 'azure', 'kubernetes', 'docker', 'ci/cd', 'terraform', 'sre'],
  startup: ['startup', 'early-stage', 'pre-seed', 'yc ', 'y combinator', 'techstars', 'accelerator', 'incubator'],
  hiring: ['hiring', 'join us', 'looking for', 'apply now', 'open position'],
  product: ['product manager', 'product management', 'roadmap', 'user research', 'product lead', ' pm '],
  design: ['designer', 'figma', 'ux design', 'ui design', 'visual design', 'brand design'],
  data: ['data science', 'data engineer', 'analytics', ' etl', 'bigquery', 'snowflake', ' dbt'],
  security: ['security', 'cybersecurity', 'infosec', 'pentest', 'appsec', 'vulnerability'],
  mobile: ['mobile dev', ' ios ', 'android', 'react native', 'flutter', 'swift', 'kotlin'],
  'open-source': ['open source', ' oss ', 'github', 'contributor', 'maintainer'],
};

// ---------------------------------------------------------------------------
// Role detection patterns
// ---------------------------------------------------------------------------
const ROLE_PATTERNS: Array<{ role: string; pattern: RegExp }> = [
  { role: 'engineer', pattern: /\b(engineer|developer|dev|programmer|swe)\b/i },
  { role: 'founder', pattern: /\b(founder|co-founder|cofounder|ceo)\b/i },
  { role: 'investor', pattern: /\b(investor|vc|venture|angel|partner at|gp at)\b/i },
  { role: 'designer', pattern: /\b(designer|design lead|ux|ui\/ux)\b/i },
  { role: 'product', pattern: /\b(product manager|product lead|head of product)\b/i },
  { role: 'recruiter', pattern: /\b(recruiter|talent|hiring manager)\b/i },
  { role: 'executive', pattern: /\b(cto|coo|cfo|vp of|vice president|director of)\b/i },
  { role: 'researcher', pattern: /\b(researcher|research scientist|phd|professor)\b/i },
  { role: 'marketer', pattern: /\b(marketer|marketing|growth lead|content creator)\b/i },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function stripUrls(text: string): string {
  return text.replace(/https?:\/\/\S+/g, '');
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
}

function fingerprint(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 120);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export function extractTopicTags(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  const tags: Set<string> = new Set();

  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        tags.add(topic);
        break;
      }
    }
  }
  return Array.from(tags);
}

export function extractRoles(text: string): string[] {
  const roles: string[] = [];
  for (const { role, pattern } of ROLE_PATTERNS) {
    if (pattern.test(text)) roles.push(role);
  }
  return roles;
}

export interface SearchDocumentInput {
  name: string;
  screenName: string;
  description: string | null;
  location: string | null;
  tweets: RawTweet[];
}

export interface SearchDocumentOutput {
  searchDocument: string;
  topicTags: string[];
  roles: string[];
  tweetSnippets: string[];
}

export function buildSearchDocument(input: SearchDocumentInput): SearchDocumentOutput {
  const parts: string[] = [];
  const seen = new Set<string>();

  const addUnique = (text: string) => {
    const fp = fingerprint(text);
    if (fp.length < 6 || seen.has(fp)) return false;
    seen.add(fp);
    return true;
  };

  // Profile section
  if (input.name) parts.push(input.name);
  if (input.screenName) parts.push(`@${input.screenName}`);
  if (input.description) {
    const clean = normalizeWhitespace(stripUrls(input.description));
    if (addUnique(clean)) parts.push(clean);
  }
  if (input.location) parts.push(input.location);

  // Recent tweets — de-duped, cleaned
  const tweetSnippets: string[] = [];
  for (const tweet of input.tweets.slice(0, 20)) {
    const cleaned = normalizeWhitespace(stripUrls(tweet.text));
    if (cleaned.length > 15 && addUnique(cleaned)) {
      tweetSnippets.push(cleaned);
    }
  }

  if (tweetSnippets.length > 0) {
    parts.push('Recent: ' + tweetSnippets.slice(0, 10).join(' | '));
  }

  // Tag / role extraction runs on combined text
  const allText = parts.join(' ');
  const topicTags = extractTopicTags(allText);
  const roles = extractRoles(allText);

  if (topicTags.length > 0) parts.push('Topics: ' + topicTags.join(', '));
  if (roles.length > 0) parts.push('Roles: ' + roles.join(', '));

  return {
    searchDocument: parts.join('. ').slice(0, 8000),
    topicTags,
    roles,
    tweetSnippets: tweetSnippets.slice(0, 5),
  };
}
