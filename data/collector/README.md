# Future collection contract (not implemented)

Store raw responses separately from normalized observations so adapters can be rerun.
Use UTC ISO 8601 for timestamps, WGS84 `[longitude, latitude]`, seconds for durations,
and `null` for unavailable fields. Never record an API key or credential-bearing URL.

Proposed normalized JSONL record:

```json
{
    "schemaVersion": 1,
    "observedAt": "2026-10-20T12:00:00.000Z",
    "sourceUpdatedAt": null,
    "source": "tfl-unified-api",
    "sourceEndpoint": "/Line/Mode/tube,dlr,overground,elizabeth-line,tram/Status",
    "dataState": "live",
    "mode": "tube",
    "lineId": "central",
    "stopId": null,
    "locationId": null,
    "coordinates": null,
    "status": "Minor Delays",
    "tripId": null,
    "predictedArrivalAt": null,
    "predictedTravelSeconds": null,
    "disruptionIds": [],
    "disruptionDescriptions": [],
    "baseline": {
        "windowStart": null,
        "windowEnd": null,
        "expectedTravelSeconds": null,
        "sampleCount": null
    },
    "outcome": {
        "actualArrivalAt": null,
        "actualTravelSeconds": null,
        "delaySeconds": null,
        "labelObservedAt": null,
        "labelSource": null
    }
}
```

This is a schema illustration, not a collected observation. Optional BikePoint counts
belong in a source-specific extension. Rail status describes a line, not an individual
journey's delay. `observedAt` is collection time; `sourceUpdatedAt` comes from the source
and may be much older. Deduplicate by source, entity ID and source update / collection
time according to the collection cadence. Keep outage, missing-field and quality flags.
Decide collection frequency, retention and API quota before enabling a collector.
