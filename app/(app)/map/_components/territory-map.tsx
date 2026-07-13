"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FocusTarget } from "@/lib/geo/focus";
import { formatAreaM2, formatClaimDate } from "@/lib/format";

const BENGALURU: [number, number] = [77.5946, 12.9716];
const OFMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

// Theme palette colours as hex - MapLibre layer paint can't use CSS vars
const OWN_FILL     = "#828B6A"; // Sage - your ground
const OWN_STROKE   = "#4A5240"; // darker Sage
const RIVAL_FILL   = "#C25B3F"; // Terracotta - everyone else's
const RIVAL_STROKE = "#8F3E28"; // darker Terracotta
const WALK_PATH_COLOR = "#C25B3F"; // Terracotta

// Data-driven paint: colour by ownership so adjacent territories from
// different owners never blend into one blob (a rival clipping your edge
// used to be invisible - same sage on sage).
function ownershipPaint(userId: string | null) {
  const isMine = ["==", ["get", "owner_id"], userId ?? ""] as const;
  return {
    fill: ["case", isMine, OWN_FILL, RIVAL_FILL] as unknown as maplibregl.ExpressionSpecification,
    stroke: ["case", isMine, OWN_STROKE, RIVAL_STROKE] as unknown as maplibregl.ExpressionSpecification,
  };
}

const EMPTY_GEOJSON: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

interface TerritoryMapProps {
  walkPoints: Array<[number, number]>; // [lng, lat] - GeoJSON order
  currentPosition: [number, number] | null;
  geojson: GeoJSON.FeatureCollection;  // managed by TanStack Query in MapClient
  focusTarget: FocusTarget | null;     // initial camera target, applied once
  currentUserId: string | null;        // to badge the viewer's own territories
  onLocateFix: (fix: [number, number]) => void; // locate button got a fresh fix
}

// Custom control instead of maplibre's GeolocateControl: that one renders
// its own blue dot, which would clash with the app's terracotta marker.
// Styled with maplibre's ctrl classes so it stacks under the zoom buttons.
class LocateControl implements maplibregl.IControl {
  private container: HTMLDivElement | null = null;
  private button: HTMLButtonElement | null = null;

  constructor(private readonly onClick: () => void) {}

  onAdd(): HTMLElement {
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.title = "Focus on my location";
    this.button.setAttribute("aria-label", "Focus on my location");
    // Crosshair in #333 - the same colour maplibre hard-codes in its own
    // control icons (the ctrl buttons stay white in both app themes, so
    // currentColor would go near-invisible in dark mode)
    this.button.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" style="display:block;margin:auto">' +
      '<circle cx="12" cy="12" r="3.5"/>' +
      '<path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22"/></svg>';
    this.button.onclick = this.onClick;
    this.container.appendChild(this.button);
    return this.container;
  }

  onRemove(): void {
    this.container?.remove();
    this.container = null;
    this.button = null;
  }

  setBusy(busy: boolean): void {
    if (!this.button) return;
    this.button.disabled = busy;
    this.button.style.opacity = busy ? "0.5" : "";
  }
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
  onLocateFix,
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
  const onLocateFixRef = useRef(onLocateFix);
  geojsonRef.current  = geojson;
  positionRef.current = currentPosition;
  focusRef.current    = focusTarget;
  onLocateFixRef.current = onLocateFix;
  const locateControlRef = useRef<LocateControl | null>(null);

  // Locate button: fly to the last known fix immediately, or request a
  // fresh one when we don't have any yet (e.g. GPS was slow on load).
  function focusOnLocation(map: maplibregl.Map) {
    const flyTo = (fix: [number, number]) =>
      map.flyTo({ center: fix, zoom: Math.max(map.getZoom(), 16), duration: 800 });

    const known = positionRef.current;
    if (known) {
      flyTo(known);
      return;
    }
    if (!("geolocation" in navigator)) return;
    locateControlRef.current?.setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // The fix can arrive after unmount (cleanup nulls mapRef) or after
        // a re-init swapped the map - never touch a removed map instance.
        if (mapRef.current !== map) return;
        const fix: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        onLocateFixRef.current(fix); // parent state -> dot appears
        locateControlRef.current?.setBusy(false);
        flyTo(fix);
      },
      () => {
        if (mapRef.current !== map) return;
        locateControlRef.current?.setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  }

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
    locateControlRef.current = new LocateControl(() => focusOnLocation(map));
    map.addControl(locateControlRef.current, "top-right");

    map.on("load", () => {
      // Territories layer - data flows in via the geojson prop; colours
      // are ownership-driven (own sage / rival terracotta)
      const paint = ownershipPaint(userIdRef.current);
      map.addSource("territories", { type: "geojson", data: EMPTY_GEOJSON });
      map.addLayer({
        id: "territories-fill",
        type: "fill",
        source: "territories",
        paint: {
          "fill-color": paint.fill,
          "fill-opacity": 0.35,
        },
      });
      map.addLayer({
        id: "territories-outline",
        type: "line",
        source: "territories",
        paint: {
          "line-color": paint.stroke,
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
      locateControlRef.current = null;
      map.remove(); // also detaches all map/layer event listeners and controls
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

  // ── Re-colour ownership when the session resolves (after map init) ─────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReadyRef.current || !map.getLayer("territories-fill")) return;
    const paint = ownershipPaint(currentUserId);
    map.setPaintProperty("territories-fill", "fill-color", paint.fill);
    map.setPaintProperty("territories-outline", "line-color", paint.stroke);
  }, [currentUserId]);

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

  return (
    // The map container must be an IN-FLOW flex child, not absolute:
    // maplibre-gl.css (loaded after globals.css with the lazy map chunk)
    // stamps `.maplibregl-map { position: relative }` on it, overriding
    // Tailwind's `absolute` and collapsing the height to 0.
    <div className="relative flex-1 w-full flex">
      <div ref={containerRef} className="flex-1 w-full" />
      {/* Ownership legend - mirrors the layer paint above */}
      <div className="absolute top-3 left-3 z-10 rounded-md border border-border/60 bg-background/90 px-3 py-2 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-xs">
          <span
            aria-hidden
            className="inline-block size-3 rounded-sm border"
            style={{ backgroundColor: "rgba(130,139,106,0.55)", borderColor: OWN_STROKE }}
          />
          <span>Yours</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          <span
            aria-hidden
            className="inline-block size-3 rounded-sm border"
            style={{ backgroundColor: "rgba(194,91,63,0.55)", borderColor: RIVAL_STROKE }}
          />
          <span>Rivals</span>
        </div>
      </div>
    </div>
  );
}
