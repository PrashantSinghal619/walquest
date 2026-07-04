"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

const BENGALURU: [number, number] = [77.5946, 12.9716];
const OFMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Theme palette colours as hex - MapLibre layer paint can't use CSS vars
const TERRITORY_FILL   = "#828B6A"; // Sage
const TERRITORY_STROKE = "#4A5240"; // darker Sage
const WALK_PATH_COLOR  = "#C25B3F"; // Terracotta

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface TerritoryMapProps {
  walkPoints: Array<[number, number]>; // [lng, lat] - GeoJSON order
  currentPosition: [number, number] | null;
  geojson: GeoJSON.FeatureCollection;  // managed by TanStack Query in MapClient
}

export default function TerritoryMap({
  walkPoints,
  currentPosition,
  geojson,
}: TerritoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const markerRef    = useRef<maplibregl.Marker | null>(null);
  const mapReadyRef  = useRef(false); // true once map 'load' has fired

  // ── Init: create map, add sources + layers ──────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OFMAP_STYLE,
      center: BENGALURU,
      zoom: 13,
      attributionControl: false,
    });

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      // Territories layer - data flows in via the geojson prop
      map.addSource("territories", { type: "geojson", data: EMPTY_GEOJSON });
      map.addLayer({
        id: "territories-fill",
        type: "fill",
        source: "territories",
        paint: {
          "fill-color": TERRITORY_FILL,
          "fill-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "territories-outline",
        type: "line",
        source: "territories",
        paint: {
          "line-color": TERRITORY_STROKE,
          "line-width": 2,
        },
      });

      // Live walk-path layer - updates as GPS points come in
      map.addSource("walk-path", { type: "geojson", data: EMPTY_GEOJSON });
      map.addLayer({
        id: "walk-path-line",
        type: "line",
        source: "walk-path",
        paint: {
          "line-color": WALK_PATH_COLOR,
          "line-width": 3,
          "line-dasharray": [2, 1],
        },
      });

      // GPS position marker
      const el = document.createElement("div");
      el.className = "gps-dot";
      el.style.cssText =
        "width:14px;height:14px;border-radius:50%;background:#C25B3F;border:2px solid #fff;box-shadow:0 0 0 4px rgba(194,91,63,0.25)";

      markerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(BENGALURU)
        .addTo(map);
      markerRef.current.getElement().style.display = "none";

      mapReadyRef.current = true;
    });

    mapRef.current = map;

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      mapReadyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Push updated territories into MapLibre whenever the prop changes ────────
  useEffect(() => {
    if (!mapRef.current || !mapReadyRef.current) return;
    const source = mapRef.current.getSource("territories") as maplibregl.GeoJSONSource | undefined;
    source?.setData(geojson);
  }, [geojson]);

  // ── Update walk-path source as GPS points accumulate ───────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) return;

    const source = map.getSource("walk-path") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    if (walkPoints.length < 2) {
      source.setData(EMPTY_GEOJSON);
      return;
    }

    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "LineString", coordinates: walkPoints },
          properties: {},
        },
      ],
    });
  }, [walkPoints]);

  // ── Move GPS marker when position updates ──────────────────────────────────
  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;

    if (!currentPosition) {
      marker.getElement().style.display = "none";
      return;
    }

    marker.setLngLat(currentPosition);
    marker.getElement().style.display = "block";

    if (mapRef.current && walkPoints.length === 1) {
      mapRef.current.panTo(currentPosition, { duration: 500 });
    }
  }, [currentPosition, walkPoints.length]);

  return <div ref={containerRef} className="flex-1 w-full" />;
}
