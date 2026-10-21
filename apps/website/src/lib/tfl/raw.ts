// External fields remain unknown until runtime validation. Only fields used by the adapters
// are listed; TfL adds many other fields which should never leak into React components.
export type RawRailLine = {
    id?: unknown;
    name?: unknown;
    modeName?: unknown;
    lineStatuses?: unknown;
    disruptions?: unknown;
};
export type RawRailStatus = {
    statusSeverity?: unknown;
    statusSeverityDescription?: unknown;
    reason?: unknown;
    validityPeriods?: unknown;
    disruption?: unknown;
};
export type RawRoadDisruption = {
    id?: unknown;
    location?: unknown;
    point?: unknown;
    geography?: unknown;
    severity?: unknown;
    status?: unknown;
    category?: unknown;
    comments?: unknown;
    currentUpdate?: unknown;
    currentUpdateDateTime?: unknown;
    lastModifiedTime?: unknown;
    startDateTime?: unknown;
    endDateTime?: unknown;
    corridorIds?: unknown;
};
export type RawBikePoint = {
    id?: unknown;
    commonName?: unknown;
    lat?: unknown;
    lon?: unknown;
    additionalProperties?: unknown;
};
