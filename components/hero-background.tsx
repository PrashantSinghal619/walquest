/**
 * Decorative, purely ornamental background for the hero section.
 *
 * Mobile-first only (~390-430px wide viewports) — no responsive variants
 * for larger screens yet, that's deferred.
 *
 * Motifs: a GPS walking route that closes into a claimed "territory"
 * polygon, layered over faint topographic contour lines and a sparse
 * map-grid texture. Colors come entirely from the existing theme CSS
 * variables so it adapts to light/dark automatically without any JS.
 *
 * This is a static inline SVG: no randomness, no client state, no
 * network/image requests — safe under static prerendering and won't
 * affect LCP since it carries no text and sits behind the hero copy.
 */
export function HeroBackground() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 400 700"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
    >
      {/* Sparse map-grid texture */}
      <g stroke="var(--border)" strokeWidth="1" opacity="0.5">
        <path d="M0 120 H400" />
        <path d="M0 260 H400" />
        <path d="M0 400 H400" />
        <path d="M0 540 H400" />
        <path d="M70 0 V700" />
        <path d="M200 0 V700" />
        <path d="M330 0 V700" />
      </g>

      {/* Faint topographic contour lines */}
      <g fill="none" stroke="var(--secondary)" strokeWidth="2" opacity="0.35">
        <path d="M-40 160 C 60 100, 160 220, 260 150 S 460 120, 520 200" />
        <path d="M-40 210 C 60 150, 160 270, 260 200 S 460 170, 520 250" />
        <path d="M-30 540 C 80 480, 180 600, 300 520 S 480 480, 540 560" />
        <path d="M-30 585 C 80 525, 180 645, 300 565 S 480 525, 540 605" />
      </g>

      {/* Claimed territory polygon (the closed loop of a walking route) */}
      <polygon
        points="120,310 230,290 270,370 235,455 140,460 95,390"
        fill="var(--accent)"
        opacity="0.22"
      />
      <polygon
        points="120,310 230,290 270,370 235,455 140,460 95,390"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.5"
        opacity="0.55"
      />

      {/* GPS walking path tracing toward / closing the territory */}
      <path
        d="M20 60 C 70 110, 40 190, 95 240 S 60 300, 95 390"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="2 12"
        opacity="0.6"
      />
      <path
        d="M95 390 L140 460 L235 455 L270 370 L230 290 L120 310 L95 390"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="2 12"
        opacity="0.6"
      />

      {/* Start marker */}
      <circle cx="20" cy="60" r="5" fill="var(--primary)" opacity="0.55" />
      {/* Waypoint markers along the territory's vertices */}
      <circle cx="230" cy="290" r="4" fill="var(--primary)" opacity="0.5" />
      <circle cx="270" cy="370" r="4" fill="var(--primary)" opacity="0.5" />
      <circle cx="140" cy="460" r="4" fill="var(--primary)" opacity="0.5" />

      {/* Scattered unclaimed hex/territory tiles, lower on the canvas */}
      <g fill="none" stroke="var(--secondary)" strokeWidth="1.5" opacity="0.4">
        <polygon points="60,560 90,545 120,560 120,592 90,608 60,592" />
        <polygon points="300,90 326,76 352,90 352,118 326,132 300,118" />
        <polygon points="320,470 350,455 380,470 380,502 350,518 320,502" />
      </g>
    </svg>
  );
}
