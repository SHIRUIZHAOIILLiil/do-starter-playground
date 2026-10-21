# DO App Kit

A starter for creating DO custom applications.

This checkout adds a Phase 1 TfL data integration spike. The original 2×3 Mini-DO,
two operator panels, city controls, zoom, arc selection and reconnect tools remain.
TfL road and bike layers are enabled by default; the original arcs are available
through **Starter arcs** or **Shuffle Selection**.

## Run the TfL demo

Requires Node >=22.12 and pnpm 10.33. From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:5780/. The homepage includes three feed cards with LIVE / STALE /
MOCK status, collection times, normalization diagnostics and expandable records.
The map shows amber/orange road disruptions, teal bike stations, pink empty stations,
and grey unavailable or unknown bike stations. Use **Focus London data** on either
operator panel and toggle layers; both panels and all connected screens synchronize.
The initial view is already centred on London. Narrow windows scroll vertically.

Optional: copy `apps/website/.env.example` to `apps/website/.env.local`, set
`TFL_APP_KEY` (and `TFL_APP_ID` if supplied), then restart. Register at
https://api-portal.tfl.gov.uk/. Never use a `VITE_` prefix for credentials.
Set `TFL_DEMO_MODE=mock` in that file and restart for explicit synthetic demo mode.
The background basemap still requires internet access.

```bash
pnpm test
pnpm --filter website exec tsc --noEmit
pnpm exec vp lint
pnpm --filter website build
# With the dev server running and TfL reachable; asserts LIVE data and WebSocket sync:
pnpm smoke:tfl
```

For a production build, run `node apps/website/.output/server/index.mjs` from the root
(port 3000 by default). Production credentials are runtime environment variables;
Node's `--env-file=apps/website/.env.local` option can load the optional local file.

See [Phase 1 implementation notes](docs/phase-1.md) for endpoints, field examples,
caching, failure behaviour, file responsibilities, limitations and Phase 2 work.

This starter repo is built with Vite+.

## Runtime Context Note (Top-Level vs Iframe)

Data Observatory deployments may render an app either:

- as a top-level document, or
- inside one or more iframes (for multi-screen orchestration/simulation).

This matters for graphics-heavy features: iframe-based deployments can increase pressure on
browser/GPU context limits (especially with WebGL). For that reason, this example includes
runtime-aware rendering decisions and fallback strategies so behavior remains stable in both modes.

## Stack Used In This Example

The example app in `apps/website` focuses on three package groups:

- `@tanstack/react-router`: file-based routing and route-level app structure (`/`, `/control`, `/screen`, `/bus`).
- `@tanstack/pacer`: throttling of high-frequency control events before broadcast (for example slider updates).
- Mapping stack:
  `maplibre-gl`, `@vis.gl/react-maplibre`, `@deck.gl/core`, `@deck.gl/layers`, `@deck.gl/react`.
  These are used to render the map, draw animated paths/markers, and support both richer and iframe-safe rendering paths. We strongly recommend the use of Deck.GL with MapLibre as the DO natively supports them.
- `vite-plus` (`vp`): monorepo task runner/repo manager used for project commands (`vp run dev`, `vp run build -r`, etc.).

## Development

- Check everything is ready:

```bash
pnpm exec vp run ready
```

- Run the tests:

```bash
pnpm test
```

- Build the monorepo:

```bash
pnpm --filter website build
```

- Run the development server:

```bash
pnpm dev
```
