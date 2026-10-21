export const TFL_SOURCES = ['rail', 'roads', 'bikes'] as const;
export type TflSource = (typeof TFL_SOURCES)[number];
export type Coordinates = [longitude: number, latitude: number];

export type RailStatus = {
    severity: number | null;
    label: string;
    reason: string | null;
    validFrom: string | null;
    validTo: string | null;
};

export type RailLine = {
    id: string;
    name: string;
    mode: string;
    statuses: RailStatus[];
    disruptions: string[];
};

export type RoadDisruption = {
    id: string;
    location: string;
    coordinates: Coordinates | null;
    severity: string;
    status: string;
    category: string | null;
    description: string | null;
    currentUpdate: string | null;
    updatedAt: string | null;
    startsAt: string | null;
    endsAt: string | null;
    roadIds: string[];
};

export type BikeStation = {
    id: string;
    name: string;
    coordinates: Coordinates | null;
    totalDocks: number | null;
    availableBikes: number | null;
    standardBikes: number | null;
    eBikes: number | null;
    emptyDocks: number | null;
    installed: boolean | null;
    locked: boolean | null;
    updatedAt: string | null;
    // A positive difference can indicate broken docks. Keep the reported counts intact.
    dockCountDifference: number | null;
};

export type TflItems = { rail: RailLine; roads: RoadDisruption; bikes: BikeStation };
export type NormalizationStats = {
    received: number;
    accepted: number;
    rejected: number;
    duplicates: number;
    missingCoordinates: number;
};
export type Normalized<T> = { items: T[]; diagnostics: NormalizationStats };
export type TflFeed<S extends TflSource> = Normalized<TflItems[S]> & {
    source: S;
    state: 'live' | 'stale' | 'mock';
    // null for synthetic examples: never stamp mock observations as newly fetched live data.
    fetchedAt: string | null;
    checkedAt: string;
    nextRefreshAt: string;
    error: string | null;
};
export type TflFeeds = { [S in TflSource]: TflFeed<S> | null };

export function isTflSource(value: unknown): value is TflSource {
    return TFL_SOURCES.some((source) => source === value);
}

export type TflLayers = { roads: boolean; bikes: boolean; starterArcs: boolean };
export const DEFAULT_TFL_LAYERS: TflLayers = { roads: true, bikes: true, starterArcs: false };
export function parseTflLayers(value: unknown): TflLayers | null {
    if (!value || typeof value !== 'object') return null;
    const layers = value as Partial<TflLayers>;
    if (
        typeof layers.roads !== 'boolean' ||
        typeof layers.bikes !== 'boolean' ||
        typeof layers.starterArcs !== 'boolean'
    )
        return null;
    return { roads: layers.roads, bikes: layers.bikes, starterArcs: layers.starterArcs };
}

// Reserved contract for a future bus adapter; Phase 1 makes no bus requests.
export type BusArrival = {
    id: string;
    lineId: string;
    stopId: string;
    destination: string | null;
    expectedArrival: string | null;
    timeToStationSeconds: number | null;
    observedAt: string;
};
