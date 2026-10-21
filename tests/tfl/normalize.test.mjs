import assert from 'node:assert/strict';
import test from 'node:test';

import {
    normalizeBikes,
    normalizeRail,
    normalizeRoads,
    timestamp
} from '../../apps/website/src/lib/tfl/normalize.ts';
import { parseTflLayers } from '../../apps/website/src/lib/tfl/types.ts';

void test('BikePoint: string quantities, case variants, zero, missing e-bikes and dock mismatch', () => {
    const result = normalizeBikes([
        {
            id: 'station',
            commonName: 'Test station',
            lon: -0.1,
            lat: 51.5,
            additionalProperties: [
                { key: 'NbBikes', value: '0', modified: '2026-10-20T12:00:00Z' },
                { key: 'NbDocks', value: '20' },
                { key: 'nbSpaces', value: '18' },
                { key: 'Installed', value: 'true' },
                { key: 'Locked', value: 'false' }
            ]
        }
    ]);
    const item = result.items[0];
    assert.equal(item.availableBikes, 0);
    assert.equal(item.emptyDocks, 18);
    assert.equal(item.eBikes, null);
    assert.equal(item.dockCountDifference, 2);
    assert.equal(item.installed, true);
    assert.equal(item.locked, false);
    assert.deepEqual(item.coordinates, [-0.1, 51.5]);
    assert.equal(item.updatedAt, '2026-10-20T12:00:00.000Z');
});
void test('invalid counts remain unknown; duplicate IDs and malformed records are counted', () => {
    const item = {
        id: 'x',
        commonName: 'Station',
        lon: 0,
        lat: 0,
        additionalProperties: [
            { key: 'NbBikes', value: '' },
            { key: 'NbDocks', value: '-2' },
            { key: 'NbEBikes', value: 'NaN' }
        ]
    };
    const result = normalizeBikes([item, item, null, { id: 'missing-name' }]);
    assert.equal(result.items[0].availableBikes, null);
    assert.equal(result.items[0].totalDocks, null);
    assert.equal(result.items[0].eBikes, null);
    assert.equal(result.items[0].coordinates, null);
    assert.deepEqual(result.diagnostics, {
        received: 4,
        accepted: 1,
        rejected: 2,
        duplicates: 1,
        missingCoordinates: 1
    });
});
void test('Road: use geographic point, parse point string, retain unlocated records, accept empty feed', () => {
    const result = normalizeRoads([
        {
            id: 'a',
            point: '[-0.2,51.4]',
            geography: { type: 'Point', coordinates: [-0.1, 51.5] },
            status: 'Active'
        },
        { id: 'b', point: '[-0.2,51.4]', startDateTime: '2026-10-20T10:00:00Z' },
        { id: 'c', point: '[999,51]' },
        { id: 'd', point: 'invalid json' }
    ]);
    assert.deepEqual(result.items[0].coordinates, [-0.1, 51.5]);
    assert.deepEqual(result.items[1].coordinates, [-0.2, 51.4]);
    assert.equal(result.items[1].startsAt, '2026-10-20T10:00:00.000Z');
    assert.equal(result.diagnostics.missingCoordinates, 2);
    assert.equal(result.items[2].severity, 'Unknown');
    assert.deepEqual(normalizeRoads([]).items, []);
});
void test('Rail: preserve all simultaneous statuses and disruption descriptions', () => {
    const { items } = normalizeRail([
        {
            id: 'central',
            name: 'Central',
            modeName: 'tube',
            disruptions: [{ description: 'Planned works' }],
            lineStatuses: [
                {
                    statusSeverity: 9,
                    statusSeverityDescription: 'Minor Delays',
                    reason: ' Signal fault ',
                    validityPeriods: [
                        { fromDate: '2026-10-19T00:00:00Z', isNow: false },
                        {
                            fromDate: '2026-10-20T12:00:00Z',
                            toDate: '2026-10-21T00:00:00Z',
                            isNow: true
                        }
                    ]
                },
                {
                    statusSeverity: 5,
                    statusSeverityDescription: 'Part Closure',
                    disruption: { description: 'Station works' }
                }
            ]
        }
    ]);
    assert.equal(items[0].statuses.length, 2);
    assert.deepEqual(items[0].disruptions, ['Planned works', 'Signal fault', 'Station works']);
    assert.equal(items[0].statuses[0].validFrom, '2026-10-20T12:00:00.000Z');
});
void test('malformed payloads and empty rail/bikes trigger fallback rather than fabricated live values', () => {
    for (const normalize of [normalizeRail, normalizeRoads, normalizeBikes]) {
        assert.throws(() => normalize({ error: 'denied' }));
        assert.throws(() => normalize([null, {}]));
    }
    assert.throws(() => normalizeRail([]));
    assert.throws(() => normalizeBikes([]));
    assert.equal(timestamp('0001-01-01T00:00:00'), null);
    assert.equal(timestamp('invalid'), null);
});
void test('layer messages reject malformed values and copy only supported fields', () => {
    assert.equal(parseTflLayers({ roads: 'true', bikes: true, starterArcs: false }), null);
    assert.equal(parseTflLayers(null), null);
    assert.deepEqual(parseTflLayers({ roads: false, bikes: true, starterArcs: false, extra: 1 }), {
        roads: false,
        bikes: true,
        starterArcs: false
    });
});
