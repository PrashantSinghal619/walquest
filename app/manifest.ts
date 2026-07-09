import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest. Installability (Android home screen)
// requires: name, icons incl. 512px, start_url, display standalone.
// No service worker needed - Chrome dropped that requirement, and this
// app is online-only by nature (map tiles, Supabase, GPS claims).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "walquest",
    short_name: "walquest",
    description: "Walk it. Claim it. Defend it. Bengaluru's territory game.",
    start_url: "/map",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F2EDDC", // Parchment
    theme_color: "#4A5240", // dark Sage - status bar while installed
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Full-bleed background, content in the safe zone - safe to mask
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
