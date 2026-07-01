"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Bengaluru city centre [longitude, latitude]
const BENGALURU: [number, number] = [77.5946, 12.9716];
// OpenFreeMap — free, no API key, vector tiles
const OFMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export default function TerritoryMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  // Hold the Map instance across renders without triggering re-renders
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    // Guard: skip if already initialised or container not yet in DOM
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OFMAP_STYLE,
      center: BENGALURU,
      zoom: 13,
      // Disable the default inline attribution so we can use compact mode
      attributionControl: false,
    });

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right"
    );
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    mapRef.current = map;

    // MapLibre reads the container dimensions at init time. If the layout
    // settles after init (e.g. scrollbar appears/disappears, dev toolbar
    // renders), the canvas stays stale. ResizeObserver keeps it in sync.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // The div must be a direct DOM child of the flex column so flex-1
  // gives it the remaining viewport height — MapLibre needs explicit px height.
  return <div ref={containerRef} className="flex-1 w-full" />;
}
