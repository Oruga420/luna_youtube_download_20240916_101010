const SVG_ICON = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8b5cf6" />
      <stop offset="100%" stop-color="#ec4899" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.25)" />
    </filter>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#g)" filter="url(#shadow)" />
  <path
    fill="#fff"
    d="M26.5 20.4c-1.3-.8-3-.4-3.8.9-.3.5-.5 1-.5 1.6v18.2c0 1.5 1.2 2.8 2.8 2.8.6 0 1.1-.2 1.6-.5l16.8-9.1c1.3-.7 1.8-2.4 1.1-3.7-.3-.5-.6-.8-1.1-1.1z"
  />
  <circle cx="22" cy="22" r="5" fill="rgba(255,255,255,0.2)" />
  <circle cx="46" cy="42" r="6" fill="rgba(255,255,255,0.15)" />
</svg>`;

export const runtime = "edge";
export const dynamic = "force-static";

export function GET() {
  return new Response(SVG_ICON, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
