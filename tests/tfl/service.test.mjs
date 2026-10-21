import assert from 'node:assert/strict';
import test from 'node:test';

import { MOCK_PAYLOADS } from '../../apps/website/src/lib/tfl/mock.ts';
import { createTflService } from '../../apps/website/src/lib/tfl/service.ts';

void test('six concurrent screens coalesce requests and respect the 30 second cache', async () => {
    let clock = Date.parse('2026-10-20T12:00:00Z');
    let calls = 0;
    const service = createTflService({
        now: () => clock,
        fetcher: async () => {
            calls++;
            return Response.json(MOCK_PAYLOADS.bikes);
        }
    });
    const feeds = await Promise.all(Array.from({ length: 6 }, () => service.get('bikes')));
    assert.equal(calls, 1);
    assert.ok(feeds.every((feed) => feed === feeds[0]));
    assert.equal(feeds[0].state, 'live');
    clock += 29_999;
    await service.get('bikes');
    assert.equal(calls, 1);
    clock++;
    await service.get('bikes');
    assert.equal(calls, 2);
});
void test('429 backs off; failed refresh uses original timestamp, then mock after ten minutes, then recovers', async () => {
    let clock = Date.parse('2026-10-20T12:00:00Z');
    let failed = false;
    let calls = 0;
    const service = createTflService({
        now: () => clock,
        fetcher: async () => {
            calls++;
            return failed
                ? new Response('', { status: 429, headers: { 'Retry-After': '120' } })
                : Response.json(MOCK_PAYLOADS.rail);
        }
    });
    const live = await service.get('rail');
    failed = true;
    clock += 30_000;
    const stale = await service.get('rail');
    assert.equal(stale.state, 'stale');
    assert.equal(stale.fetchedAt, live.fetchedAt);
    assert.equal(Date.parse(stale.nextRefreshAt) - clock, 120_000);
    await service.get('rail');
    assert.equal(calls, 2);
    clock += 11 * 60_000;
    const mock = await service.get('rail');
    assert.equal(mock.state, 'mock');
    assert.equal(mock.fetchedAt, null);
    failed = false;
    clock += 120_000;
    assert.equal((await service.get('rail')).state, 'live');
});
void test('partial source failure does not hide successful feeds; credentials stay out of error output', async () => {
    const service = createTflService({
        appKey: 'private-test-key',
        fetcher: async (url) => {
            assert.equal(new URL(url).searchParams.get('app_key'), 'private-test-key');
            if (url.pathname.includes('Road')) throw new Error('secret URL ' + url.href);
            return Response.json(
                url.pathname.includes('BikePoint') ? MOCK_PAYLOADS.bikes : MOCK_PAYLOADS.rail
            );
        }
    });
    const [rail, road, bike] = await Promise.all([
        service.get('rail'),
        service.get('roads'),
        service.get('bikes')
    ]);
    assert.equal(rail.state, 'live');
    assert.equal(road.state, 'mock');
    assert.equal(bike.state, 'live');
    assert.ok(!JSON.stringify(road).includes('private-test-key'));
});
void test('authentication, invalid JSON, malformed response and timeouts degrade safely', async () => {
    for (const fetcher of [
        async () => new Response('', { status: 401 }),
        async () => new Response('{broken'),
        async () => Response.json({ unexpected: true }),
        async () => {
            throw new DOMException('Timed out', 'TimeoutError');
        }
    ]) {
        const feed = await createTflService({ fetcher }).get('bikes');
        assert.equal(feed.state, 'mock');
        assert.equal(feed.fetchedAt, null);
        assert.ok(feed.error);
    }
});
void test('empty road data is valid live data; explicit demo mode makes no upstream calls', async () => {
    const live = await createTflService({ fetcher: async () => Response.json([]) }).get('roads');
    assert.equal(live.state, 'live');
    assert.equal(live.items.length, 0);
    let calls = 0;
    const demo = createTflService({
        mockOnly: true,
        fetcher: async () => {
            calls++;
            throw new Error('should not run');
        }
    });
    assert.equal((await demo.get('bikes')).state, 'mock');
    assert.equal(calls, 0);
});
