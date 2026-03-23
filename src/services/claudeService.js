import Anthropic from "@anthropic-ai/sdk";

/**
 * Two-phase Claude integration:
 *
 * Phase A — annotateGraph: given graph topology + community structure,
 *   label each community and explain bridge nodes.
 *
 * Phase B — suggestExpansions: given the current graph, recommend
 *   additional Wikipedia articles that would deepen or bridge it.
 *
 * Both phases are combined into a single API call for efficiency.
 */
export async function analyseGraph({ nodes, edges, communities, centrality }) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("VITE_ANTHROPIC_API_KEY not set in .env");

  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  // Group node titles by community
  const communityGroups = {};
  nodes.forEach((n) => {
    const c = communities[n.id] ?? 0;
    if (!communityGroups[c]) communityGroups[c] = [];
    communityGroups[c].push(n.title);
  });

  // Top-N bridges by betweenness centrality
  const topBridges = Object.entries(centrality)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => nodes.find((n) => n.id === id)?.title)
    .filter(Boolean);

  const seeds = nodes.filter((n) => n.isSeed).map((n) => n.title);

  const communityBlock = Object.entries(communityGroups)
    .map(
      ([c, titles]) =>
        `  Community ${c} (${titles.length} nodes): ${titles.join(", ")}`
    )
    .join("\n");

  const edgeCount = edges.length;
  const avgDegree = nodes.length > 0 ? ((edgeCount * 2) / nodes.length).toFixed(1) : 0;

  const prompt = `You are analysing a knowledge graph discovered automatically through Wikipedia's hyperlink structure — not curated by a human, but emergent from how Wikipedia editors chose to link articles.

SEEDS (user-selected starting articles):
${seeds.join(", ")}

GRAPH STATS: ${nodes.length} nodes, ${edgeCount} edges, avg degree ${avgDegree}

COMMUNITIES (detected via link topology):
${communityBlock}

HIGHEST BETWEENNESS CENTRALITY (structural bridges between communities):
${topBridges.join(", ")}

TASK — return a single JSON object with three keys:

1. "communities" — for each community index, provide:
   - "label": 2–5 word name for the intellectual tradition or domain
   - "explanation": 2 sentences on what this cluster represents and why Wikipedia's link structure grouped these articles together

2. "bridges" — for the top 3 bridge articles (by betweenness), provide 1–2 sentences explaining their structural role: what intellectual function makes them central connectors?

3. "suggestions" — 4–5 additional Wikipedia article titles that would:
   - Introduce an underrepresented perspective or tradition
   - Bridge two existing communities
   - Surface a structural gap the current seeds didn't reach
   For each: exact Wikipedia article title + 1-sentence reason.

Return ONLY valid JSON, no prose before or after:
{
  "communities": {
    "0": { "label": "...", "explanation": "..." },
    "1": { "label": "...", "explanation": "..." }
  },
  "bridges": [
    { "title": "...", "explanation": "..." }
  ],
  "suggestions": [
    { "title": "...", "reason": "..." }
  ]
}`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    temperature: 0.3,
    messages: [{ role: "user", content: prompt }],
  });

  const text = msg.content[0].text;
  const cleaned = text.replace(/^```(?:json)?\n?|\n?```$/gm, "").trim();
  return JSON.parse(cleaned);
}
