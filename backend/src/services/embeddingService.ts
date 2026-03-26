import { ENRICHMENT_CONFIG } from '../config/enrichment';

const VECTOR_DIM = ENRICHMENT_CONFIG.EMBEDDING_DIMENSIONS;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s#@._-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function hashToken(token: string, seed: number): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function l2Normalize(vec: number[]) {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) sumSq += vec[i] * vec[i];
  if (sumSq === 0) return vec;
  const inv = 1 / Math.sqrt(sumSq);
  for (let i = 0; i < vec.length; i++) vec[i] *= inv;
  return vec;
}

function localEmbed(text: string): number[] {
  const vec = new Array<number>(VECTOR_DIM).fill(0);
  const tokens = tokenize(text);
  for (const token of tokens) {
    const h1 = hashToken(token, 17);
    const h2 = hashToken(token, 53);
    const idx = h1 % VECTOR_DIM;
    const sign = h2 % 2 === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  return l2Normalize(vec);
}

/**
 * Generate deterministic local embeddings (no external API).
 * Uses a hashing-trick sparse projection into fixed-size vectors.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const startedAt = Date.now();
  console.log(
    `[Embedding] Start | totalInputs=${texts.length} mode=local model=${ENRICHMENT_CONFIG.EMBEDDING_MODEL} dims=${VECTOR_DIM}`,
  );

  const results = texts.map((text) => localEmbed(text || ''));

  console.log(
    `[Embedding] Complete | totalEmbeddings=${results.length} durationMs=${Date.now() - startedAt}`,
  );
  return results;
}

export async function generateSingleEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}
