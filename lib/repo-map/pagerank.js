'use strict';

// Weighted PageRank over the file dependency graph. Nodes are repo-relative
// file paths; a directed edge from→to means `from` imports `to`. The resulting
// rank is the centrality signal the scan uses to read hubs deeply and skim
// leaves — the same idea Aider's repo-map uses to rank files for an LLM.

const DAMPING = 0.85;
const MAX_ITERATIONS = 50;
const CONVERGENCE = 1e-6;

// nodes: string[] of all file paths.
// edges: Array<{ from, to, weight }>.
// Returns Map<file, rank> summing to ~1.
function pagerank(nodes, edges) {
  const n = nodes.length;
  if (n === 0) return new Map();

  const index = new Map(nodes.map((node, i) => [node, i]));
  const out = nodes.map(() => []); // out[i] = [{ j, weight }]
  const outWeight = new Array(n).fill(0);

  for (const e of edges) {
    const i = index.get(e.from);
    const j = index.get(e.to);
    if (i === undefined || j === undefined || i === j) continue;
    const w = e.weight > 0 ? e.weight : 1;
    out[i].push({ j, weight: w });
    outWeight[i] += w;
  }

  let rank = new Array(n).fill(1 / n);
  const base = (1 - DAMPING) / n;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const next = new Array(n).fill(base);

    // Dangling nodes (no out-edges) redistribute their mass uniformly.
    let dangling = 0;
    for (let i = 0; i < n; i++) if (outWeight[i] === 0) dangling += rank[i];
    const danglingShare = (DAMPING * dangling) / n;

    for (let i = 0; i < n; i++) {
      if (outWeight[i] === 0) continue;
      const share = (DAMPING * rank[i]) / outWeight[i];
      for (const { j, weight } of out[i]) next[j] += share * weight;
    }
    for (let i = 0; i < n; i++) next[i] += danglingShare;

    let delta = 0;
    for (let i = 0; i < n; i++) delta += Math.abs(next[i] - rank[i]);
    rank = next;
    if (delta < CONVERGENCE) break;
  }

  return new Map(nodes.map((node, i) => [node, rank[i]]));
}

module.exports = { pagerank };
