import { ScatterplotLayer } from '@deck.gl/layers';
import type { Map as MapInstance, GeoJSONSource } from 'maplibre-gl';
import { useEffect, useMemo } from 'react';

import type { BikeStation, Coordinates, TflFeeds, TflLayers } from '../lib/tfl/types';

type Marker = {
    id: string;
    position: Coordinates;
    color: [number, number, number, number];
    radius: number;
};
function bikeColor(bike: BikeStation): Marker['color'] {
    if (bike.locked || bike.installed === false || bike.availableBikes === null)
        return [148, 163, 184, 230];
    return bike.availableBikes === 0 ? [244, 114, 182, 240] : [45, 212, 191, 230];
}
export function tflMarkers(feeds: TflFeeds, layers: TflLayers): Marker[] {
    const markers: Marker[] = [];
    if (layers.bikes)
        for (const bike of feeds.bikes?.items ?? []) {
            if (bike.coordinates)
                markers.push({
                    id: bike.id,
                    position: bike.coordinates,
                    color: bikeColor(bike),
                    radius: 7
                });
        }
    if (layers.roads)
        for (const road of feeds.roads?.items ?? []) {
            if (road.coordinates)
                markers.push({
                    id: road.id,
                    position: road.coordinates,
                    color: /serious|severe/i.test(road.severity)
                        ? [251, 113, 80, 255]
                        : [251, 191, 36, 255],
                    radius: 13
                });
        }
    return markers;
}
export function createTflDeckLayer(markers: Marker[]) {
    return new ScatterplotLayer<Marker>({
        id: 'tfl-live-markers',
        data: markers,
        getPosition: (d) => d.position,
        getFillColor: (d) => d.color,
        getRadius: (d) => d.radius,
        radiusUnits: 'pixels',
        stroked: true,
        getLineColor: [15, 23, 42, 255],
        lineWidthMinPixels: 1.5,
        pickable: false
    });
}
const SOURCE = 'tfl-live-points';
const LAYER = 'tfl-live-circles';
export function TflMapLayers({ map, markers }: { map: MapInstance | null; markers: Marker[] }) {
    const data = useMemo(
        () => ({
            type: 'FeatureCollection' as const,
            features: markers.map((marker) => ({
                type: 'Feature' as const,
                geometry: { type: 'Point' as const, coordinates: marker.position },
                properties: {
                    id: marker.id,
                    color: `rgba(${marker.color.slice(0, 3).join(',')},${marker.color[3] / 255})`,
                    radius: marker.radius
                }
            }))
        }),
        [markers]
    );
    useEffect(() => {
        if (!map) return;
        const sync = () => {
            if (!map.isStyleLoaded()) return;
            const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
            if (source) source.setData(data);
            else map.addSource(SOURCE, { type: 'geojson', data });
            if (!map.getLayer(LAYER))
                map.addLayer({
                    id: LAYER,
                    type: 'circle',
                    source: SOURCE,
                    paint: {
                        'circle-radius': ['get', 'radius'],
                        'circle-color': ['get', 'color'],
                        'circle-stroke-color': '#0f172a',
                        'circle-stroke-width': 1.5
                    }
                });
        };
        sync();
        map.on('load', sync);
        map.on('style.load', sync);
        return () => {
            map.off('load', sync);
            map.off('style.load', sync);
        };
    }, [map, data]);
    useEffect(
        () => () => {
            if (!map || !map.getStyle()) return;
            if (map.getLayer(LAYER)) map.removeLayer(LAYER);
            if (map.getSource(SOURCE)) map.removeSource(SOURCE);
        },
        [map]
    );
    return null;
}
