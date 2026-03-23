# Wiki Graph Explorer

An interactive knowledge graph tool that discovers how Wikipedia articles connect, detects intellectual communities, and uses Claude to annotate what emerges.

## What it does

1. **Seed input** — Enter 2–10 Wikipedia article titles or URLs
2. **Graph discovery** — Fetches outlinks from seed articles, scores intermediate articles by shared link frequency, selects up to 25 "bridge" articles, and builds an undirected edge graph
3. **Local analysis** — Runs betweenness centrality (Brandes algorithm) and community detection (label propagation) on the resulting graph
4. **Claude annotation** — Sends graph topology to Claude Sonnet, which labels each community, explains structural bridges, and suggests additional articles to deepen the graph
5. **Interactive visualization** — D3 force-directed graph with zoom/pan, node selection, community legend, and a right-side insight panel

## Tech stack

- **React 18** + **Vite** — frontend framework and build tooling
- **D3.js 7** — force-directed graph layout, SVG rendering, zoom/pan
- **Anthropic SDK** — Claude API calls (runs client-side)
- **Wikipedia REST API** — article and link fetching

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and add your Anthropic API key:

```
VITE_ANTHROPIC_API_KEY=your_key_here
```

```bash
npm run dev     # development server
npm run build   # production build
npm run preview # serve built dist
```

## Project structure

```
src/
├── App.jsx                  # Main orchestrator, phase state machine (seed → loading → ready)
├── main.jsx                 # React entry point
├── components/
│   ├── SeedInput.jsx        # Article input form
│   ├── GraphCanvas.jsx      # D3 graph visualization
│   └── InsightPanel.jsx     # Right sidebar: node info, communities, bridges, suggestions
├── services/
│   ├── wikiIngestion.js     # Wikipedia API traversal and graph construction
│   └── claudeService.js     # Claude API integration and prompt construction
└── utils/
    └── graphAnalysis.js     # Betweenness centrality and community detection algorithms
```

## Example seeds

- Gilles Deleuze, Frantz Fanon, Donna Haraway, W.E.B. Du Bois, Hannah Arendt
- Any mix of Wikipedia titles or full article URLs

## Notes

- The Claude annotation step is non-blocking — the graph renders immediately after local analysis completes
- The Anthropic API key is used client-side via Vite's `VITE_` env prefix; do not commit `.env`
- Graph discovery fetches up to 500 outlinks per seed article and selects the 25 highest-scoring bridge nodes
