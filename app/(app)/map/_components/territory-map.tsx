"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FocusTarget } from "@/lib/geo/focus";
import { formatAreaM2, formatClaimDate } from "@/lib/format";

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
  focusTarget: FocusTarget | null;     // initial camera target, applied once
  currentUserId: string | null;        // to badge the viewer's own territories
}

// Feature properties arrive through MapLibre as plain JSON
type TerritoryProps = {
  owner_id?: string;
  owner_name?: string;
  area_m2?: number;
  claimed_at?: string;
};

// Built with DOM APIs (textContent), never innerHTML - owner_name derives
// from an email local part, which is user-controlled input.
function buildPopupContent(props: TerritoryProps, currentUserId: string | null): HTMLElement {
  const root = document.createElement("div");
  root.style.cssText = "display:flex;flex-direction:column;gap:2px;min-width:140px";

  const owner = document.createElement("p");
  owner.style.cssText = "font-weight:600;font-size:0.875rem;margin:0";
  owner.textContent =
    props.owner_id && props.owner_id === currentUserId
      ? `${props.owner_name ?? "You"} (you)`
      : (props.owner_name ?? "Unknown walker");

  const area = document.createElement("p");
  area.style.cssText = "font-size:0.8rem;margin:0;opacity:0.75";
  area.textContent = typeof props.area_m2 === "number" ? formatAreaM2(props.area_m2) : "";

  const claimed = document.createElement("p");
  claimed.style.cssText = "font-size:0.75rem;margin:0;opacity:0.6";
  claimed.textContent = props.claimed_at ? `claimed ${formatClaimDate(props.claimed_at)}` : "";

  root.append(owner, area, claimed);
  return root;
}

export default function TerritoryMap({
  walkPoints,
  currentPosition,
  geojson,
  focusTarget,
  currentUserId,
}: TerritoryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<maplibregl.Map | null>(null);
  const markerRef    = useRef<maplibregl.Marker | null>(null);
  const popupRef     = useRef<maplibregl.Popup | null>(null);
  const mapReadyRef  = useRef(false); // true once map 'load' has fired
  const focusDoneRef = useRef(false); // the initial focus fires exactly once
  const userIdRef    = useRef(currentUserId);
  userIdRef.current  = currentUserId; // session resolves after map init

  // Latest props, readable from the 'load' handler: data can arrive before
  // the map finishes loading, and the prop effects below skip until it's
  // ready. The load handler applies whatever is current at that moment.
  const geojsonRef  = useRef(geojson);
  const positionRef = useRef(currentPosition);
  const focusRef    = useRef(focusTarget);
  geojsonRef.current  = geojson;
  positionRef.current = currentPosition;
  focusRef.current    = focusTarget;

  function applyFocus(map: maplibregl.Map) {
    const target = focusRef.current;
    if (!target || focusDoneRef.current) return;
    focusDoneRef.current = true;
    if (target.kind === "bounds") {
      map.fitBounds(target.bounds, { padding: 60, maxZoom: 16, duration: 800 });
    } else {
      map.flyTo({ center: target.center, zoom: 15, duration: 800 });
    }
  }

  // Safe at any time: no-op until the marker exists (it is created in the
  // 'load' handler, so a non-null marker implies the map is ready).
  function applyPosition() {
    const marker = markerRef.current;
    if (!marker) return;
    const position = positionRef.current;
    if (!position) {
      marker.getElement().style.display = "none";
      return;
    }
    marker.setLngLat(position);
    marker.getElement().style.display = "block";
  }

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

      // Territory popup: owner, area, claim date
      map.on("click", "territories-fill", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ maxWidth: "260px", offset: 8 })
          .setLngLat(e.lngLat)
          .setDOMContent(
            buildPopupContent(feature.properties as TerritoryProps, userIdRef.current)
          )
          .addTo(map);
      });
      map.on("mouseenter", "territories-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "territories-fill", () => {
        map.getCanvas().style.cursor = "";
      });

      // Apply whatever arrived while the style was still loading - without
      // this, early data waits for the next prop change (up to a 45 s poll).
      (map.getSource("territories") as maplibregl.GeoJSONSource).setData(geojsonRef.current);
      applyPosition();
      applyFocus(map);
    });

    mapRef.current = map;

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove(); // also detaches all map/layer event listeners
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

  // ── One-time initial focus once both the map and the target are ready ──────
  useEffect(() => {
    if (!mapRef.current || !mapReadyRef.current) return;
    applyFocus(mapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTarget]);

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
  // If the marker doesn't exist yet (map still loading), this no-ops and the
  // 'load' handler applies the pending position instead.
  useEffect(() => {
    applyPosition();

    if (mapRef.current && mapReadyRef.current && currentPosition && walkPoints.length === 1) {
      mapRef.current.panTo(currentPosition, { duration: 500 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPosition, walkPoints.length]);

  return <div ref={containerRef} className="flex-1 w-full" />;
}
