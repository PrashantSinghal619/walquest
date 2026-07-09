"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "@/components/ui/button";
import {
  buildReplayTrack,
  pointAtFraction,
  type LngLat,
} from "@/lib/geo/replay";

const OFMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const FULL_PATH_COLOR = "#828B6A"; // Sage - the whole recorded route
const PROGRESS_COLOR = "#C25B3F"; // Terracotta - walked-so-far during replay
const REPLAY_DURATION_MS = 6000;

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

function lineFC(coords: LngLat[]): GeoJSON.FeatureCollection {
  if (coords.length < 2) return EMPTY;
  return {
    type: "FeatureCollection",
    features: [
      { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} },
    ],
  };
}

export default function WalkReplayMap({ path }: { path: LngLat[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const rafRef = useRef<number | null>(null);
  const trackRef = useRef(buildReplayTrack(path));
  const [status, setStatus] = useState<"loading" | "playing" | "done">("loading");

  function renderFrame(fraction: number) {
    const map = mapRef.current;
    if (!map) return;
    const { point, lastIndex } = pointAtFraction(trackRef.current, fraction);
    const walked = trackRef.current.points.slice(0, lastIndex + 1).concat([point]);
    (map.getSource("progress") as maplibregl.GeoJSONSource | undefined)?.setData(lineFC(walked));
    markerRef.current?.setLngLat(point);
  }

  function play() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    setStatus("playing");
    const startedAt = performance.now();
    const tick = (now: number) => {
      const fraction = Math.min(1, (now - startedAt) / REPLAY_DURATION_MS);
      renderFrame(fraction);
      if (fraction < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        setStatus("done");
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const bounds = path.reduce(
      (b, p) => b.extend(p),
      new maplibregl.LngLatBounds(path[0], path[0])
    );

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OFMAP_STYLE,
      bounds,
      fitBoundsOptions: { padding: 48, maxZoom: 17 },
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      map.addSource("full-path", { type: "geojson", data: lineFC(path) });
      map.addLayer({
        id: "full-path-line",
        type: "line",
        source: "full-path",
        paint: { "line-color": FULL_PATH_COLOR, "line-width": 3, "line-dasharray": [2, 1.5] },
      });
      map.addSource("progress", { type: "geojson", data: EMPTY });
      map.addLayer({
        id: "progress-line",
        type: "line",
        source: "progress",
        paint: { "line-color": PROGRESS_COLOR, "line-width": 4 },
      });

      const el = document.createElement("div");
      el.style.cssText =
        "width:14px;height:14px;border-radius:50%;background:#C25B3F;border:2px solid #fff;box-shadow:0 0 0 4px rgba(194,91,63,0.25)";
      markerRef.current = new maplibregl.Marker({ element: el }).setLngLat(path[0]).addTo(map);

      play(); // autoplay once on load
    });

    mapRef.current = map;
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative h-96 w-full overflow-hidden rounded-lg border">
      <div ref={containerRef} className="h-full w-full" />
      {status === "done" && (
        <Button
          size="sm"
          variant="outline"
          onClick={play}
          className="absolute bottom-3 left-1/2 -translate-x-1/2 backdrop-blur-sm"
        >
          ↺ Replay
        </Button>
      )}
    </div>
  );
}
