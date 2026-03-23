# CLAUDE.md — Wiki Graph Explorer

## Project overview

React + D3 + Vite app that builds interactive knowledge graphs from Wikipedia. Users enter seed articles; the app traverses Wikipedia links, runs graph analysis locally, and sends results to Claude for community labeling and expansion suggestions.

## Tech stack

- React 18, Vite 6
- D3.js 7 (force simulation, SVG, zoom)
- Anthropic SDK 0.35 (client-side, key via `VITE_ANTHROPIC_API_KEY`)
- Wikipedia REST API (`en.wikipedia.org/w/api.php`)

## Key files

| File | Purpose |
|------|---------|
| `src/App.jsx` | Phase state machine: `seed → loading → ready`. Orchestrates ingestion, analysis, and Claude calls |
| `src/services/wikiIngestion.js` | Wikipedia API traversal: fetches outlinks, scores bridge articles, builds edge graph |
| `src/services/claudeService.js` | Constructs Claude prompt, calls API, parses JSON response for community labels and suggestions |
| `src/utils/graphAnalysis.js` | Brandes betweenness centrality + label propagation community detection |
| `src/components/GraphCanvas.jsx` | D3 force-directed graph: node sizing by centrality, coloring by community, zoom/pan, click selection |
| `src/components/InsightPanel.jsx` | Right sidebar: selected node info, community labels, bridge roles, expansion suggestions |
| `src/components/SeedInput.jsx` | Input form: 2–10 Wikipedia titles or URLs |

## Architecture

1. `wikiIngestion.js` runs entirely client-side against the Wikipedia API (no backend)
2. Claude is called once after local graph analysis completes; it receives node list, edge list, community assignments, and bridge nodes
3. The Claude call is non-blocking — graph renders before annotation arrives
4. Claude model: `claude-sonnet-4-6`

## Claude prompt structure (claudeService.js)

The prompt sends a compact JSON payload with:
- `nodes`: array of `{id, title, community, centrality}`
- `edges`: sampled list of `[source, target]` pairs
- `communities`: map of community ID → member titles
- `bridges`: top 3 nodes by betweenness centrality

Expected JSON response shape:
```json
{
  "communityLabels": { "<id>": { "name": "...", "explanation": "..." } },
  "bridgeRoles": [{ "title": "...", "role": "..." }],
  "expansionSuggestions": [{ "title": "...", "reason": "..." }]
}
```

## Development

```bash
npm install
cp .env.example .env   # add VITE_ANTHROPIC_API_KEY
npm run dev
```

## Conventions

- Dark theme throughout: background `#0D0F14`, accent colors `#78B4D4` / `#6878A0`
- Styling via inline React style objects (no CSS files)
- All graph data held in `App.jsx` state and passed down as props
- Wikipedia article identity uses `title` (string) as the primary key across all layers
