import { TFL_ENDPOINTS, TFL_REFRESH_MS } from './config.ts';
import { MOCK_PAYLOADS } from './mock.ts';
import { normalizeBikes, normalizeRail, normalizeRoads } from './normalize.ts';
import type { Normalized, TflFeed, TflItems, TflSource } from './types.ts';

type ServiceOptions = {
    fetcher?: typeof fetch;
    now?: () => number;
    appKey?: string;
    appId?: string;
    mockOnly?: boolean;
};
const MAX_STALE_MS = 10 * 60_000;
const normalizers = { rail: normalizeRail, roads: normalizeRoads, bikes: normalizeBikes };
type Entry<S extends TflSource> = {
    latest: TflFeed<S> | null;
    lastLive: TflFeed<S> | null;
    pending: Promise<TflFeed<S>> | null;
};

class UpstreamError extends Error {
    readonly retryMs: number;
    constructor(message: string, retryMs = 60_000) {
        super(message);
        this.retryMs = retryMs;
    }
}

// One service per server process: all six screens and operator clients share the same
// in-flight requests and cache. No raw response or credential is sent to a browser.
export function createTflService(options: ServiceOptions = {}) {
    const fetcher = options.fetcher ?? fetch;
    const now = options.now ?? Date.now;
    const entries: { [S in TflSource]: Entry<S> } = {
        rail: { latest: null, lastLive: null, pending: null },
        roads: { latest: null, lastLive: null, pending: null },
        bikes: { latest: null, lastLive: null, pending: null }
    };
    function normalize<S extends TflSource>(source: S, payload: unknown): Normalized<TflItems[S]> {
        // The source key determines both the normalizer and the public feed type.
        return normalizers[source](payload) as Normalized<TflItems[S]>;
    }
    async function load<S extends TflSource>(source: S, entry: Entry<S>): Promise<TflFeed<S>> {
        let retryMs = TFL_REFRESH_MS;
        try {
            if (options.mockOnly)
                throw new UpstreamError('Demo mode enabled (TFL_DEMO_MODE=mock).');
            const url = new URL(TFL_ENDPOINTS[source], 'https://api.tfl.gov.uk');
            if (options.appKey) url.searchParams.set('app_key', options.appKey);
            if (options.appId) url.searchParams.set('app_id', options.appId);
            const response = await fetcher(url, {
                headers: { Accept: 'application/json' },
                signal: AbortSignal.timeout(10_000)
            });
            if (!response.ok) {
                const retryAfter = response.headers.get('retry-after');
                const seconds =
                    retryAfter && /^\d+$/.test(retryAfter)
                        ? Number(retryAfter) * 1000
                        : retryAfter
                          ? Date.parse(retryAfter) - now()
                          : 60_000;
                throw new UpstreamError(
                    `TfL HTTP ${response.status}${[401, 403].includes(response.status) ? ': configure TFL_APP_KEY on the server.' : ''}`,
                    Math.min(300_000, Math.max(60_000, Number.isFinite(seconds) ? seconds : 60_000))
                );
            }
            const normalized = normalize(source, await response.json());
            const time = now();
            const feed: TflFeed<S> = {
                source,
                ...normalized,
                state: 'live',
                fetchedAt: new Date(time).toISOString(),
                checkedAt: new Date(time).toISOString(),
                nextRefreshAt: new Date(time + TFL_REFRESH_MS).toISOString(),
                error: null
            };
            entry.lastLive = feed;
            entry.latest = feed;
            return feed;
        } catch (error) {
            retryMs = error instanceof UpstreamError ? error.retryMs : 60_000;
            // Don't expose fetch exceptions: they can contain credential-bearing URLs.
            const message =
                error instanceof UpstreamError
                    ? error.message
                    : 'TfL unavailable, timed out, or returned invalid data. Retry is scheduled.';
            const time = now();
            const previous = entry.lastLive;
            const canUseStale =
                previous?.fetchedAt && time - Date.parse(previous.fetchedAt) <= MAX_STALE_MS;
            const data = canUseStale ? previous : normalize(source, MOCK_PAYLOADS[source]);
            const feed: TflFeed<S> = {
                source,
                items: data.items,
                diagnostics: data.diagnostics,
                state: canUseStale ? 'stale' : 'mock',
                fetchedAt: canUseStale ? previous.fetchedAt : null,
                checkedAt: new Date(time).toISOString(),
                nextRefreshAt: new Date(time + retryMs).toISOString(),
                error: message
            };
            entry.latest = feed;
            return feed;
        }
    }
    return {
        get<S extends TflSource>(source: S): Promise<TflFeed<S>> {
            const entry: Entry<S> = entries[source];
            if (entry.pending) return entry.pending;
            if (entry.latest && now() < Date.parse(entry.latest.nextRefreshAt))
                return Promise.resolve(entry.latest);
            entry.pending = load(source, entry).finally(() => {
                entry.pending = null;
            });
            return entry.pending;
        }
    };
}
