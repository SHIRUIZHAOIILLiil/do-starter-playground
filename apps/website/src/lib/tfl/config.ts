import type { TflSource } from './types.ts';

export const TFL_ENDPOINTS: Record<TflSource, string> = {
    rail: '/Line/Mode/tube,dlr,overground,elizabeth-line,tram/Status?detail=true',
    roads: '/Road/all/Disruption',
    bikes: '/BikePoint'
};
export const TFL_REFRESH_MS = 30_000;
