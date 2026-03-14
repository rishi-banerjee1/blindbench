/**
 * Embedding-based stability metric.
 *
 * Two modes:
 *   1. OpenAI embeddings (text-embedding-3-small) — requires BYOK key
 *   2. TF-IDF cosine fallback — runs entirely client-side, no API key needed
 *
 * Operates on response texts from stability test run_details.
 * Does NOT modify any backend data.
 */

// ─── OpenAI Embedding Mode ──────────────────────────────────

/**
 * Fetch embeddings from OpenAI text-embedding-3-small.
 * @param {string[]} texts - Array of response texts
 * @param {string} apiKey - OpenAI API key (BYOK)
 * @returns {Promise<number[][]>} Array of embedding vectors
 */
export async function fetchEmbeddings(texts, apiKey) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: texts,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI embedding error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Compute embedding-based stability score using OpenAI.
 * @param {string[]} responses - Array of response texts (from stability runs)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<{score: number, pairwise: number[]}>}
 */
export async function computeEmbeddingStability(responses, apiKey) {
  if (responses.length < 2) return { score: 1, pairwise: [] };

  const embeddings = await fetchEmbeddings(responses, apiKey);
  const pairwise = [];

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = i + 1; j < embeddings.length; j++) {
      pairwise.push(cosineSimilarity(embeddings[i], embeddings[j]));
    }
  }

  const score = pairwise.reduce((a, b) => a + b, 0) / pairwise.length;
  return { score: Math.round(score * 1000) / 1000, pairwise };
}

// ─── TF-IDF Cosine Fallback (No API Key) ────────────────────

/**
 * Tokenize text into lowercase word tokens.
 */
function tokenize(text) {
  return text.toLowerCase().match(/\b[a-z]+\b/g) || [];
}

/**
 * Build TF vector for a document given a vocabulary.
 */
function buildTF(tokens, vocab) {
  const tf = new Float64Array(vocab.length);
  const counts = {};
  for (const t of tokens) {
    counts[t] = (counts[t] || 0) + 1;
  }
  for (let i = 0; i < vocab.length; i++) {
    tf[i] = counts[vocab[i]] || 0;
  }
  return tf;
}

/**
 * Compute TF-IDF cosine similarity between response texts.
 * This is a client-side fallback when no OpenAI key is available.
 * More semantically aware than Jaccard (captures term importance).
 *
 * @param {string[]} responses
 * @returns {{score: number, pairwise: number[]}}
 */
export function computeTfidfStability(responses) {
  if (responses.length < 2) return { score: 1, pairwise: [] };

  const tokenized = responses.map(tokenize);

  // Build vocabulary from all documents
  const vocabSet = new Set();
  for (const tokens of tokenized) {
    for (const t of tokens) vocabSet.add(t);
  }
  const vocab = [...vocabSet];

  // Compute IDF
  const idf = new Float64Array(vocab.length);
  const N = tokenized.length;
  for (let i = 0; i < vocab.length; i++) {
    const df = tokenized.filter((tokens) =>
      tokens.includes(vocab[i])
    ).length;
    idf[i] = Math.log((N + 1) / (df + 1)) + 1; // smoothed IDF
  }

  // Build TF-IDF vectors
  const vectors = tokenized.map((tokens) => {
    const tf = buildTF(tokens, vocab);
    const tfidf = new Float64Array(vocab.length);
    for (let i = 0; i < vocab.length; i++) {
      tfidf[i] = tf[i] * idf[i];
    }
    return tfidf;
  });

  // Pairwise cosine similarity
  const pairwise = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      pairwise.push(cosineSimilarity(vectors[i], vectors[j]));
    }
  }

  const score = pairwise.reduce((a, b) => a + b, 0) / pairwise.length;
  return { score: Math.round(score * 1000) / 1000, pairwise };
}

/**
 * Compute stability using best available method.
 * Tries OpenAI embeddings first; falls back to TF-IDF cosine.
 *
 * @param {string[]} responses
 * @param {string|null} openaiKey - Optional BYOK key
 * @returns {Promise<{score: number, method: string, pairwise: number[]}>}
 */
export async function computeStabilityScore(responses, openaiKey = null) {
  if (openaiKey) {
    try {
      const result = await computeEmbeddingStability(responses, openaiKey);
      return { ...result, method: "embedding" };
    } catch {
      // Fall through to TF-IDF on API error
    }
  }
  const result = computeTfidfStability(responses);
  return { ...result, method: "tfidf" };
}
