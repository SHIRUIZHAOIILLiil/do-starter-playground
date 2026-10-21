import { Store, useStore } from '@tanstack/react-store';
import { useEffect } from 'react';

import { TFL_REFRESH_MS } from './config';
import { MOCK_PAYLOADS } from './mock';
import { normalizeBikes, normalizeRail, normalizeRoads } from './normalize';
import { TFL_SOURCES, type TflFeed, type TflFeeds, type TflSource } from './types';

type ClientState = {
    feeds: TflFeeds;
    loading: boolean;
    refreshing: boolean;
};
const initial: ClientState = {
    feeds: { rail: null, roads: null, bikes: null },
    loading: true,
    refreshing: false
};
const store = new Store<ClientState>(initial);
let subscribers = 0;
let timer: ReturnType<typeof setInterval> | null = null;
let pending: Promise<void> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}
function isFeed<S extends TflSource>(value: unknown, source: S): value is TflFeed<S> {
    if (
        !isRecord(value) ||
        value.source !== source ||
        !['live', 'stale', 'mock'].includes(String(value.state)) ||
        typeof value.checkedAt !== 'string' ||
        !Number.isFinite(Date.parse(value.checkedAt)) ||
        typeof value.nextRefreshAt !== 'string' ||
        !Number.isFinite(Date.parse(value.nextRefreshAt)) ||
        !(
            value.fetchedAt === null ||
            (typeof value.fetchedAt === 'string' && Number.isFinite(Date.parse(value.fetchedAt)))
        ) ||
        !(value.error === null || typeof value.error === 'string') ||
        !isRecord(value.diagnostics) ||
        !['received', 'accepted', 'rejected', 'duplicates', 'missingCoordinates'].every(
            (key) =>
                typeof value.diagnostics === 'object' &&
                value.diagnostics !== null &&
                Number.isSafeInteger((value.diagnostics as Record<string, unknown>)[key])
        ) ||
        !Array.isArray(value.items)
    )
        return false;
    return value.items.every((item: unknown) => {
        if (!isRecord(item) || typeof item.id !== 'string') return false;
        if (source === 'rail')
            return (
                typeof item.name === 'string' &&
                typeof item.mode === 'string' &&
                Array.isArray(item.disruptions) &&
                item.disruptions.every((d: unknown) => typeof d === 'string') &&
                Array.isArray(item.statuses) &&
                item.statuses.every(
                    (s: unknown) =>
                        isRecord(s) &&
                        typeof s.label === 'string' &&
                        (s.severity === null || typeof s.severity === 'number') &&
                        (s.reason === null || typeof s.reason === 'string')
                )
            );
        const point = item.coordinates;
        if (
            !(
                point === null ||
                (Array.isArray(point) &&
                    point.length === 2 &&
                    point.every((n: unknown) => typeof n === 'number' && Number.isFinite(n)))
            )
        )
            return false;
        if (source === 'roads')
            return (
                ['location', 'severity', 'status'].every((key) => typeof item[key] === 'string') &&
                ['description', 'currentUpdate', 'updatedAt', 'startsAt', 'endsAt'].every(
                    (key) => item[key] === null || typeof item[key] === 'string'
                )
            );
        return (
            typeof item.name === 'string' &&
            [
                'totalDocks',
                'availableBikes',
                'standardBikes',
                'eBikes',
                'emptyDocks',
                'dockCountDifference'
            ].every((key) => item[key] === null || typeof item[key] === 'number') &&
            ['installed', 'locked'].every(
                (key) => item[key] === null || typeof item[key] === 'boolean'
            ) &&
            (item.updatedAt === null || typeof item.updatedAt === 'string')
        );
    });
}

async function loadSource<S extends TflSource>(source: S): Promise<void> {
    try {
        const response = await fetch(`/api/tfl/${source}`, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error('Local data endpoint unavailable');
        const feed: unknown = await response.json();
        if (!isFeed(feed, source)) throw new Error('Invalid data endpoint response');
        store.setState((previous) => ({
            ...previous,
            feeds: { ...previous.feeds, [source]: feed }
        }));
    } catch {
        const previous = store.state.feeds[source];
        const now = Date.now();
        const stale = previous?.fetchedAt && now - Date.parse(previous.fetchedAt) <= 10 * 60_000;
        const normalizers = { rail: normalizeRail, roads: normalizeRoads, bikes: normalizeBikes };
        const data = stale ? previous : normalizers[source](MOCK_PAYLOADS[source]);
        const feed = {
            source,
            items: data.items,
            diagnostics: data.diagnostics,
            state: stale ? 'stale' : 'mock',
            fetchedAt: stale ? previous.fetchedAt : null,
            checkedAt: new Date(now).toISOString(),
            nextRefreshAt: new Date(now + TFL_REFRESH_MS).toISOString(),
            error: 'Local data connection unavailable. Retrying automatically.'
        };
        store.setState((state) => ({ ...state, feeds: { ...state.feeds, [source]: feed } }));
    }
}
export function refreshTfl(): Promise<void> {
    if (pending) return pending;
    store.setState((previous) => ({ ...previous, refreshing: true }));
    pending = Promise.all(TFL_SOURCES.map(loadSource))
        .then(() => {
            store.setState((previous) => ({ ...previous, loading: false, refreshing: false }));
        })
        .finally(() => {
            pending = null;
        });
    return pending;
}
export function useTflData() {
    const state = useStore(store, (current) => current);
    useEffect(() => {
        subscribers++;
        if (subscribers === 1) {
            void refreshTfl();
            timer = setInterval(() => void refreshTfl(), TFL_REFRESH_MS);
        }
        return () => {
            subscribers--;
            if (!subscribers && timer) {
                clearInterval(timer);
                timer = null;
            }
        };
    }, []);
    return state;
}
