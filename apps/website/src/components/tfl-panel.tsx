import { refreshTfl, useTflData } from '../lib/tfl/client';
import { TFL_SOURCES, type TflSource } from '../lib/tfl/types';

const LABELS: Record<TflSource, string> = {
    rail: 'Rail / Tube status',
    roads: 'Road disruptions',
    bikes: 'Santander Cycles'
};
function time(value: string | null) {
    return value
        ? new Date(value).toLocaleTimeString('en-GB', {
              timeZone: 'Europe/London',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
          }) + ' London'
        : 'No live observation';
}
export function TflPanel() {
    const { feeds, refreshing } = useTflData();
    return (
        <section
            className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3"
            aria-label="TfL data validation"
        >
            <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                    <h2 className="text-sm font-medium">TfL live data · Phase 1</h2>
                    <p className="text-xs text-[var(--muted-foreground)]">
                        30s refresh · amber: road events · teal: bikes · pink: empty stations ·
                        grey: unknown / unavailable
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => void refreshTfl()}
                    disabled={refreshing}
                    className="shrink-0 rounded-md border border-[var(--border)] px-2 py-1 text-xs disabled:opacity-50"
                >
                    {refreshing ? 'Refreshing…' : 'Refresh data'}
                </button>
            </div>
            <div className="grid gap-3 lg:grid-cols-3">
                {TFL_SOURCES.map((source) => {
                    const feed = feeds[source];
                    return (
                        <article
                            key={source}
                            className="min-w-0 rounded-lg border border-[var(--border)] p-3"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-medium">{LABELS[source]}</h3>
                                <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${feed?.state === 'live' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'}`}
                                >
                                    {feed
                                        ? feed.state === 'mock'
                                            ? 'MOCK / EXAMPLE'
                                            : feed.state.toUpperCase()
                                        : 'LOADING'}
                                </span>
                            </div>
                            <p className="mt-2 text-xl font-semibold">
                                {feed ? feed.items.length : '—'}{' '}
                                <span className="text-xs font-normal">
                                    {source === 'rail'
                                        ? 'lines'
                                        : source === 'roads'
                                          ? 'events'
                                          : 'stations'}
                                </span>
                            </p>
                            <p className="text-xs text-[var(--muted-foreground)]">
                                Fetched: {feed ? time(feed.fetchedAt) : 'Waiting…'}
                            </p>
                            {feed?.error ? (
                                <p
                                    role="status"
                                    className="mt-2 text-xs text-amber-700 dark:text-amber-300"
                                >
                                    {feed.error}{' '}
                                    {feed.state === 'mock'
                                        ? 'Synthetic examples; not travel advice.'
                                        : 'Showing last successful data.'}
                                </p>
                            ) : null}
                            {feed ? (
                                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                                    Skipped {feed.diagnostics.rejected} · duplicates{' '}
                                    {feed.diagnostics.duplicates}
                                    {source !== 'rail'
                                        ? ` · unlocated ${feed.diagnostics.missingCoordinates}`
                                        : ''}
                                </p>
                            ) : null}
                            <details className="mt-2 text-xs">
                                <summary className="cursor-pointer">Inspect records</summary>
                                <div className="mt-2 max-h-64 space-y-2 overflow-auto" tabIndex={0}>
                                    {source === 'rail'
                                        ? feeds.rail?.items.map((line) => (
                                              <div
                                                  key={line.id}
                                                  className="border-t border-[var(--border)] pt-2"
                                              >
                                                  <p className="font-medium">
                                                      {line.name} ·{' '}
                                                      {line.statuses
                                                          .map((s) => s.label)
                                                          .join(' / ') || 'Unknown'}
                                                  </p>
                                                  {line.disruptions.map((reason) => (
                                                      <p
                                                          key={reason}
                                                          className="mt-1 text-[var(--muted-foreground)]"
                                                      >
                                                          {reason}
                                                      </p>
                                                  ))}
                                              </div>
                                          ))
                                        : null}
                                    {source === 'roads'
                                        ? feeds.roads?.items.slice(0, 30).map((road) => (
                                              <div
                                                  key={road.id}
                                                  className="border-t border-[var(--border)] pt-2"
                                              >
                                                  <p className="font-medium">
                                                      {road.location} · {road.severity} ·{' '}
                                                      {road.status}
                                                  </p>
                                                  <p>{road.description}</p>
                                                  <p>{road.currentUpdate}</p>
                                                  <p className="text-[var(--muted-foreground)]">
                                                      {road.id} · Updated {time(road.updatedAt)} ·{' '}
                                                      {road.coordinates?.join(', ') ??
                                                          'No coordinates'}
                                                  </p>
                                              </div>
                                          ))
                                        : null}
                                    {source === 'bikes'
                                        ? feeds.bikes?.items.slice(0, 30).map((bike) => (
                                              <div
                                                  key={bike.id}
                                                  className="border-t border-[var(--border)] pt-2"
                                              >
                                                  <p className="font-medium">{bike.name}</p>
                                                  <p>
                                                      {bike.availableBikes ?? '?'} bikes (
                                                      {bike.eBikes ?? '?'} electric) ·{' '}
                                                      {bike.emptyDocks ?? '?'} empty /{' '}
                                                      {bike.totalDocks ?? '?'} docks
                                                  </p>
                                                  <p className="text-[var(--muted-foreground)]">
                                                      {bike.id} · Updated {time(bike.updatedAt)}
                                                      {bike.locked ? ' · Locked' : ''}
                                                      {bike.installed === false
                                                          ? ' · Not installed'
                                                          : ''}
                                                      {bike.dockCountDifference
                                                          ? ` · Dock count difference ${bike.dockCountDifference}`
                                                          : ''}
                                                  </p>
                                              </div>
                                          ))
                                        : null}
                                    {source !== 'rail' ? (
                                        <p className="text-[var(--muted-foreground)]">
                                            Showing up to 30 records. Full normalized data:
                                            /api/tfl/{source}
                                        </p>
                                    ) : null}
                                    {feed?.items.length === 0 ? (
                                        <p>No events reported by this feed.</p>
                                    ) : null}
                                </div>
                            </details>
                        </article>
                    );
                })}
            </div>
            <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                Data provided by{' '}
                <a
                    className="underline"
                    href="https://tfl.gov.uk/info-for/open-data-users/our-open-data"
                    target="_blank"
                    rel="noreferrer"
                >
                    Transport for London
                </a>
                . Independent demo; not an official TfL service. Background map © CARTO ©
                OpenStreetMap contributors.
            </p>
        </section>
    );
}
