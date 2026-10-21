import assert from 'node:assert/strict';

const base = new URL(process.env.TFL_SMOKE_URL ?? 'http://localhost:5780');
const home = await fetch(base);
assert.equal(home.status, 200);
const html = await home.text();
const screens = [...html.matchAll(/src="(\/screen\?[^"\s]+)"/g)];
assert.equal(screens.length, 6, 'Mini-DO must retain six screen iframes');
assert.equal([...html.matchAll(/src="\/control\?/g)].length, 2, 'Mini-DO must retain two controls');
for (const screen of screens) {
    const response = await fetch(new URL(screen[1].replaceAll('&amp;', '&'), base));
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes('TfL London'));
}
for (const operator of ['A', 'B']) {
    const response = await fetch(new URL(`/control?operator=${operator}`, base));
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes('Connecting control'));
}
console.log('Mini-DO: homepage, six screen routes, and two control routes passed');
for (const source of ['rail', 'roads', 'bikes']) {
    const feeds = await Promise.all(
        Array.from({ length: 6 }, async () => {
            const response = await fetch(new URL(`/api/tfl/${source}`, base));
            assert.equal(response.status, 200);
            return response.json();
        })
    );
    assert.ok(
        feeds.every((feed) => feed.state === 'live'),
        `${source} must contain live data`
    );
    assert.ok(
        feeds.every((feed) => feed.fetchedAt === feeds[0].fetchedAt),
        'Concurrent clients must share a snapshot'
    );
    console.log(`${source}: LIVE, ${feeds[0].items.length} records, fetched ${feeds[0].fetchedAt}`);
}
assert.equal((await fetch(new URL('/api/tfl/unknown', base))).status, 404);
assert.equal((await fetch(new URL('/bus', base))).status, 426);

function peer() {
    const url = new URL('/bus', base);
    url.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(url);
    socket.binaryType = 'arraybuffer';
    const messages = [];
    const waiters = new Set();
    socket.addEventListener('message', (event) => {
        messages.push(
            JSON.parse(
                typeof event.data === 'string' ? event.data : new TextDecoder().decode(event.data)
            )
        );
        for (const wake of waiters) wake();
    });
    function waitFor(predicate) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                waiters.delete(wake);
                reject(new Error('WebSocket test timed out'));
            }, 8000);
            const wake = () => {
                const found = messages.find(predicate);
                if (!found) return;
                clearTimeout(timeout);
                waiters.delete(wake);
                resolve(found);
            };
            waiters.add(wake);
            wake();
        });
    }
    return { socket, waitFor };
}
// Two operators plus six display clients, using the actual production transport.
const peers = Array.from({ length: 8 }, peer);
const [a, b] = peers;
let late;
let validator;
let original;
try {
    original = (await a.waitFor((m) => m.type === 'hello')).state;
    await Promise.all(peers.slice(1).map((client) => client.waitFor((m) => m.type === 'hello')));
    const layers = { ...original.tflLayers, bikes: !original.tflLayers.bikes };
    a.socket.send(JSON.stringify({ type: 'tfl/layers', layers }));
    for (const broadcast of await Promise.all(
        peers.slice(1).map((client) => client.waitFor((m) => m.type === 'tfl/layers'))
    )) {
        assert.deepEqual(broadcast.layers, layers);
    }
    const zoom = original.zoom === 12 ? 12.5 : 12;
    const indexes = original.selectedSegmentIndexes.length ? [] : [1, 2, 3];
    b.socket.send(JSON.stringify({ type: 'screen/map-view', city: 'london', view: { zoom } }));
    b.socket.send(JSON.stringify({ type: 'screen/segment-selection', indexes }));
    await Promise.all(
        peers
            .filter((client) => client !== b)
            .map(async (client) => {
                const view = await client.waitFor((m) => m.type === 'screen/map-view');
                assert.equal(view.view.zoom, zoom);
                const selection = await client.waitFor(
                    (m) => m.type === 'screen/segment-selection'
                );
                assert.deepEqual(selection.indexes, indexes);
            })
    );
    peers[7].socket.close();
    late = peer();
    const hello = await late.waitFor((m) => m.type === 'hello');
    assert.deepEqual(hello.state.tflLayers, layers, 'Reconnected screen must receive layer state');
    assert.equal(hello.state.zoom, zoom);
    assert.equal(hello.state.city, 'london');
    assert.deepEqual(hello.state.selectedSegmentIndexes, indexes);
    a.socket.send(JSON.stringify({ type: 'tfl/layers', layers: { roads: 'invalid' } }));
    await b.waitFor((m) => m.type === 'tfl/layers' && m.layers.roads === 'invalid');
    validator = peer();
    const validState = (await validator.waitFor((m) => m.type === 'hello')).state;
    assert.deepEqual(
        validState.tflLayers,
        layers,
        'Malformed layer messages must not poison shared state'
    );
    console.log(
        'WebSocket: two operators / six displays, layer and zoom sync, selection, reconnect, invalid message checks passed'
    );
} finally {
    if (original && a.socket.readyState === WebSocket.OPEN) {
        a.socket.send(JSON.stringify({ type: 'tfl/layers', layers: original.tflLayers }));
        a.socket.send(
            JSON.stringify({
                type: 'screen/map-view',
                city: original.city,
                view: { zoom: original.zoom }
            })
        );
        a.socket.send(
            JSON.stringify({
                type: 'screen/segment-selection',
                indexes: original.selectedSegmentIndexes
            })
        );
        await b.waitFor(
            (m) => m.type === 'tfl/layers' && m.layers.bikes === original.tflLayers.bikes
        );
    }
    peers.forEach((client) => client.socket.close());
    late?.socket.close();
    validator?.socket.close();
}
