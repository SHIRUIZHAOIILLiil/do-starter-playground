# Phase 1: TfL integration

The goal is to validate the flow of real TfL data into the existing 2×3 Mini-DO.
No neural model, journey recommendation, persistent database, Green Wave, JamCam
or 3D feature is implemented. Bus arrival types are reserved; no bus feed is fetched.

## Data flow

Browser polling -> `/api/tfl/{rail|roads|bikes}` -> shared server cache -> TfL fetch ->
runtime normalization -> typed feed -> React summary / DeckGL or MapLibre markers.
Raw TfL objects never enter the rendering components. Controls continue using the
existing `/bus` WebSocket transport; `tfl/layers` adds validated visibility state,
included in the `hello` snapshot for late joiners.

## Sources and fields

Base URL: `https://api.tfl.gov.uk`.

| Local endpoint   | TfL endpoint                                                            | Raw fields used                                                                                                                                                                                   | Internal fields                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/tfl/rail`  | `/Line/Mode/tube,dlr,overground,elizabeth-line,tram/Status?detail=true` | `id`, `name`, `modeName`, `lineStatuses[].statusSeverity`, `statusSeverityDescription`, `reason`, `validityPeriods`, nested `disruption.description`, `disruptions[].description`                 | `id`, `name`, `mode`, `statuses[]`, deduplicated `disruptions[]`                                                                                  |
| `/api/tfl/roads` | `/Road/all/Disruption`                                                  | `id`, `location`, `point`, `geography`, `severity`, `status`, `category`, `comments`, `currentUpdate`, `lastModifiedTime`, `currentUpdateDateTime`, `startDateTime`, `endDateTime`, `corridorIds` | `coordinates`, `description`, `currentUpdate`, `updatedAt`, `startsAt`, `endsAt`, `roadIds`, severity/status strings                              |
| `/api/tfl/bikes` | `/BikePoint`                                                            | `id`, `commonName`, `lon`, `lat`, `additionalProperties` keys `NbDocks`, `NbBikes`, `NbEmptyDocks` / `NbSpaces`, `NbEBikes`, `NbStandardBikes`, `Installed`, `Locked`, `modified`                 | `coordinates`, `totalDocks`, `availableBikes`, `emptyDocks`, `eBikes`, `standardBikes`, `installed`, `locked`, `updatedAt`, `dockCountDifference` |

Actual integration checks on 20 October 2026 returned 20 rail lines, 110 road events,
and 801 BikePoints with HTTP 200, without credentials. These counts will change.
The final production smoke check later that day returned 20 lines, 119 road events,
and 801 BikePoints, confirming the road feed was updating rather than a fixed fixture.
Example observed fields included `bakerloo` / `Minor Delays`, road `TIMS-200007`
with `point: "[-0.087718,51.512021]"`, and `BikePoints_1` with `NbDocks: "19"`,
`NbBikes: "3"`, `NbEmptyDocks: "14"`, `NbEBikes: "3"`. These are historical
integration observations, not current travel information.

Official references:

- [Unified API overview](https://tfl.gov.uk/info-for/open-data-users/unified-api)
- [API schema](https://api.tfl.gov.uk/swagger/docs/v1)
- [Open data feeds and terms](https://tfl.gov.uk/info-for/open-data-users/our-open-data)
- [Developer portal](https://api-portal.tfl.gov.uk/)

TfL's guidance calls for registration and access tokens. Anonymous success in a local
test does not guarantee future access or a particular quota. This app supports server
`TFL_APP_KEY` and optional `TFL_APP_ID`, reports HTTP 401/403, and backs off on errors.
Confirm your own plan's quota in the portal; no numeric account quota is assumed.
The Road feed describes reported road events, not comprehensive traffic speeds or
all London road coverage. Rail modes cover the listed TfL services, not all National Rail.

## Normalization and quality

- Validate array shape and entity IDs/names; discard malformed entries and duplicate IDs
  while reporting `received`, `accepted`, `rejected`, `duplicates`, `missingCoordinates`.
- Convert nonnegative safe integer strings to numbers. Empty, negative and invalid values
  stay `null`; unknown counts never become zero. Property names are case insensitive.
- Prefer road GeoJSON Point coordinates; otherwise parse `point`. Coordinates use WGS84
  `[longitude, latitude]`. Reject non-finite, out-of-range and placeholder `[0,0]` values.
  Keep unlocated records in lists, but omit their map markers. No coordinates are invented.
- Preserve all rail statuses, reasons and validity periods; no generic severity number
  is assigned across modes. A missing status is `Unknown`, not `Good Service`.
- Dates normalize to UTC ISO 8601; invalid/default year-0001 dates become `null`.
  UI times use Europe/London. `fetchedAt` is collection time, not source update time.
- Preserve BikePoint counts even if docks != bikes + empty docks. The difference can
  indicate broken docks; it is surfaced rather than silently repaired. e-bikes may be
  absent. Locked/uninstalled/unknown stations display grey, distinct from zero bikes.

## Refresh, cache and failure behaviour

- Each browser document shares one polling subscription; independent iframes poll
  local endpoints every 30 seconds. A per-process server cache and in-flight promise
  coalesce requests, normally yielding at most one upstream call per source per 30s.
  Separate server processes do not share a cache. No timer runs without local requests.
- Ten-second upstream and fifteen-second local request timeouts bound loading states.
- Failures retry after at least 60 seconds, using Retry-After when supplied, bounded
  to five minutes. Each source fails independently. The Refresh button respects the
  server cache and backoff; it does not force extra upstream traffic.
- Retain the last successful feed for up to ten minutes as `stale`, with its original
  `fetchedAt`. Then use small synthetic examples marked `mock`, with `fetchedAt: null`.
  First-load failure immediately uses examples. A successful retry restores `live`.
- The client also handles local endpoint failures with stale / synthetic fallback.
  Mock examples carry `demo-` IDs, example names, and visible warnings. Do not use
  them for travel advice, historical baselines or training.
- An empty roads array is valid live data; empty rail/bikes arrays and entirely
  malformed responses trigger fallback. Mixed validity retains valid records and
  reports rejections. Credentials and raw fetch exception URLs never reach the UI.
- The existing CARTO basemap requires network access. Data fallback does not cache map
  tiles. Opening many standalone DeckGL tabs may exhaust device WebGL resources;
  Mini-DO iframes retain the lighter MapLibre rendering path.

## Important files

| File                                                            | Responsibility                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `apps/website/src/lib/tfl/raw.ts`                               | Untrusted TfL response fields                                                     |
| `apps/website/src/lib/tfl/types.ts`                             | Internal entities, feed metadata, validated layers, future bus contract           |
| `apps/website/src/lib/tfl/normalize.ts`                         | Pure data validation, conversion, diagnostics                                     |
| `apps/website/src/lib/tfl/config.ts`                            | Fixed allowlisted endpoints and polling interval                                  |
| `apps/website/src/lib/tfl/mock.ts`                              | Explicit synthetic fallback payloads                                              |
| `apps/website/src/lib/tfl/service.ts`                           | Fetching, per-source cache/coalescing, timeout, backoff, stale/fallback selection |
| `apps/website/src/lib/tfl/server.ts`                            | Server runtime configuration, service singleton                                   |
| `apps/website/src/lib/tfl/client.ts`                            | Shared browser store, polling lifecycle, local error handling                     |
| `apps/website/src/routes/api.tfl.$source.ts`                    | Read-only server endpoint, rejects unknown source names                           |
| `apps/website/src/components/tfl-panel.tsx`                     | Feed states, timestamps, diagnostics and expandable records                       |
| `apps/website/src/components/tfl-map-layers.tsx`                | Shared marker classification, DeckGL / MapLibre layers                            |
| `apps/website/src/routes/index.tsx`                             | Existing Mini-DO plus data panel; prevents zero-height wall                       |
| `apps/website/src/routes/control.tsx`                           | Existing controls plus synchronized layer toggles and London focus                |
| `apps/website/src/routes/screen.tsx`                            | Existing tile cameras, new layers and data-state overlays                         |
| `apps/website/src/routes/bus.ts`, realtime types/engines        | Layer message validation, broadcast, late-join replay                             |
| `apps/website/src/routes/__root.tsx`                            | Allow intentional pre-hydration theme class on html                               |
| `apps/website/vite.config.ts`, `.env.example`                   | Load server-only TfL configuration in development                                 |
| `vite.config.ts`, `.gitignore`                                  | Keep generated output out of lint/Git; ignore local secrets                       |
| `tests/tfl/*.test.mjs`, `scripts/smoke-tfl.mjs`, `package.json` | Unit/failure tests and live HTTP/WebSocket smoke checks                           |
| `data/`                                                         | Preliminary collection schema and modelling constraints                           |

`routeTree.gen.ts` is regenerated by the existing router plugin to include the API route.
No dependency or framework was added.

## Manual acceptance checks

1. Run `pnpm dev`, open http://localhost:5780/. Confirm all three feeds show LIVE,
   real IDs and source fields, counts, collection times and normalization diagnostics.
2. Inspect the 2×3 wall and open a screen independently. Confirm road markers and bike
   availability use the same geometry in both rendering paths.
3. In Tablet #1, toggle Bike availability / Road events. Confirm Tablet #2 mirrors the
   checkbox and the markers change on all screens. Press Focus London data / zoom.
4. Enable Starter arcs or Shuffle Selection to check preserved starter functionality.
5. Disconnect/reconnect or refresh a screen. It should recover current shared controls.
   A newly opened control should receive current layer/zoom/selection state.
6. Set `TFL_DEMO_MODE=mock` and restart. Confirm every feed is labelled MOCK / EXAMPLE,
   error descriptions remain visible, and example markers render without crashing.
   Restore live mode and restart afterwards. Stale/expiry/429 behaviour is also tested
   deterministically by `pnpm test`, without waiting for a real TfL outage.
7. Run `pnpm test`, TypeScript, lint, build, and `pnpm smoke:tfl` while the server runs.
   The smoke command checks six screen routes and two control routes, then connects
   two operator and six display peers. It briefly changes layers, zoom and arc selection,
   validates reconnect replay, and restores the original state.

## Suggested Phase 2

First capture real snapshots and review source update cadence, missingness and coverage.
Choose one focused mobility question before growing the UI. Introduce an append-only
collector only after deciding retention and quota; see `data/collector/README.md`.
Build time-of-day / weekday baselines and data-quality charts before "Now vs Normally".
Bus arrival predictions can implement the reserved contract if they support that question.
Journey-reliability modelling additionally requires independently observed actual outcomes;
predictions and line statuses alone are not ground-truth journey-delay labels.
