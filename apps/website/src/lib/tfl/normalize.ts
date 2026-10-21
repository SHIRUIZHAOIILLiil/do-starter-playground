import type { RawBikePoint, RawRailLine, RawRailStatus, RawRoadDisruption } from './raw.ts';
import type {
    BikeStation,
    Coordinates,
    Normalized,
    RailLine,
    RailStatus,
    RoadDisruption
} from './types.ts';

function record(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}
function text(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function array(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}
function count(value: unknown): number | null {
    if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value)))
        return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
function flag(value: unknown): boolean | null {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return null;
}
export function timestamp(value: unknown): string | null {
    const input = text(value);
    // TfL sometimes sends the .NET default date (year 0001), which isn't an observation.
    if (!input || !/^\d{4}-\d{2}-\d{2}T/.test(input) || Number(input.slice(0, 4)) < 2000)
        return null;
    const time = Date.parse(/(?:Z|[+-]\d{2}:\d{2})$/i.test(input) ? input : `${input}Z`);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
export function coordinates(value: unknown): Coordinates | null {
    if (!Array.isArray(value) || value.length !== 2) return null;
    const [lon, lat] = value as unknown[];
    if (
        typeof lon !== 'number' ||
        typeof lat !== 'number' ||
        !Number.isFinite(lon) ||
        !Number.isFinite(lat) ||
        Math.abs(lon) > 180 ||
        Math.abs(lat) > 90 ||
        (lon === 0 && lat === 0)
    )
        return null;
    return [lon, lat];
}
function normalize<T extends { id: string }>(
    payload: unknown,
    parse: (value: Record<string, unknown>) => T | null,
    locate?: (item: T) => Coordinates | null
): Normalized<T> {
    if (!Array.isArray(payload)) throw new Error('TfL response must be an array');
    const items: T[] = [];
    const seen = new Set<string>();
    const diagnostics = {
        received: payload.length,
        accepted: 0,
        rejected: 0,
        duplicates: 0,
        missingCoordinates: 0
    };
    for (const raw of payload) {
        const object = record(raw);
        const item = object ? parse(object) : null;
        if (!item) {
            diagnostics.rejected++;
            continue;
        }
        if (seen.has(item.id)) {
            diagnostics.duplicates++;
            continue;
        }
        seen.add(item.id);
        if (locate && !locate(item)) diagnostics.missingCoordinates++;
        items.push(item);
    }
    if (payload.length > 0 && items.length === 0)
        throw new Error('No valid records in TfL response');
    diagnostics.accepted = items.length;
    items.sort((a, b) => a.id.localeCompare(b.id));
    return { items, diagnostics };
}

function railStatus(value: unknown): RailStatus | null {
    const raw: RawRailStatus | null = record(value);
    if (!raw) return null;
    const validity =
        array(raw.validityPeriods)
            .map(record)
            .find((p) => p?.isNow === true) ?? record(array(raw.validityPeriods)[0]);
    return {
        severity: count(raw.statusSeverity),
        label: text(raw.statusSeverityDescription) ?? 'Unknown',
        reason: text(raw.reason) ?? text(record(raw.disruption)?.description),
        validFrom: timestamp(validity?.fromDate),
        validTo: timestamp(validity?.toDate)
    };
}
export function normalizeRail(payload: unknown): Normalized<RailLine> {
    const result = normalize(payload, (object) => {
        const raw: RawRailLine = object;
        const id = text(raw.id),
            name = text(raw.name);
        if (!id || !name) return null;
        const statuses = array(raw.lineStatuses)
            .map(railStatus)
            .filter((s) => s !== null);
        if (!statuses.length)
            statuses.push({
                severity: null,
                label: 'Unknown',
                reason: null,
                validFrom: null,
                validTo: null
            });
        const disruptions = [
            ...array(raw.disruptions).map((d) => text(record(d)?.description)),
            ...statuses.map((s) => s.reason)
        ].filter((d) => d !== null);
        return {
            id,
            name,
            mode: text(raw.modeName) ?? 'unknown',
            statuses,
            disruptions: [...new Set(disruptions)]
        };
    });
    if (!result.items.length) throw new Error('TfL returned no rail lines');
    return result;
}

function roadCoordinates(raw: RawRoadDisruption): Coordinates | null {
    const geography = record(raw.geography);
    const point = geography?.type === 'Point' ? coordinates(geography.coordinates) : null;
    if (point) return point;
    if (typeof raw.point === 'string') {
        try {
            return coordinates(JSON.parse(raw.point));
        } catch {
            return null;
        }
    }
    return coordinates(raw.point);
}
export function normalizeRoads(payload: unknown): Normalized<RoadDisruption> {
    return normalize(
        payload,
        (object) => {
            const raw: RawRoadDisruption = object;
            const id = text(raw.id);
            if (!id) return null;
            return {
                id,
                location: text(raw.location) ?? id,
                coordinates: roadCoordinates(raw),
                severity: text(raw.severity) ?? 'Unknown',
                status: text(raw.status) ?? 'Unknown',
                category: text(raw.category),
                description: text(raw.comments),
                currentUpdate: text(raw.currentUpdate),
                updatedAt: timestamp(raw.lastModifiedTime) ?? timestamp(raw.currentUpdateDateTime),
                startsAt: timestamp(raw.startDateTime),
                endsAt: timestamp(raw.endDateTime),
                roadIds: array(raw.corridorIds)
                    .map(text)
                    .filter((s) => s !== null)
            };
        },
        (item) => item.coordinates
    );
}
export function normalizeBikes(payload: unknown): Normalized<BikeStation> {
    const result = normalize(
        payload,
        (object) => {
            const raw: RawBikePoint = object;
            const id = text(raw.id),
                name = text(raw.commonName);
            if (!id || !name) return null;
            const properties = new Map<string, unknown>();
            const updates: string[] = [];
            for (const entry of array(raw.additionalProperties)) {
                const property = record(entry);
                const key = text(property?.key)?.toLowerCase();
                if (!key) continue;
                properties.set(key, property?.value);
                const updated = timestamp(property?.modified);
                if (
                    updated &&
                    ['nbbikes', 'nbdocks', 'nbemptydocks', 'nbspaces', 'nbebikes'].includes(key)
                )
                    updates.push(updated);
            }
            const totalDocks = count(properties.get('nbdocks'));
            const availableBikes = count(properties.get('nbbikes'));
            const emptyDocks =
                count(properties.get('nbemptydocks')) ?? count(properties.get('nbspaces'));
            return {
                id,
                name,
                coordinates: coordinates([raw.lon, raw.lat]),
                totalDocks,
                availableBikes,
                emptyDocks,
                standardBikes: count(properties.get('nbstandardbikes')),
                eBikes: count(properties.get('nbebikes')),
                installed: flag(properties.get('installed')),
                locked: flag(properties.get('locked')),
                updatedAt: updates.sort().at(-1) ?? null,
                dockCountDifference:
                    totalDocks !== null && availableBikes !== null && emptyDocks !== null
                        ? totalDocks - availableBikes - emptyDocks
                        : null
            };
        },
        (item) => item.coordinates
    );
    if (!result.items.length) throw new Error('TfL returned no bike stations');
    return result;
}
