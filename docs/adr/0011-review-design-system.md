# ADR 0011: Local review design system

Date: 21 October 2026. Status: accepted for the local review redesign requested by the user.

Use React with locally built JavaScript and owned CSS tokens. Radix supplies dialog, tabs and appearance toggle keyboard semantics. An owned shadcn/ui-style Button uses Slot and class-variance-authority; Origin UI informs search fields and empty states; Magic UI informs a local SVG grid. Framer Motion supplies short page entrances with reduced motion enabled. Bundle dependencies with pinned esbuild and retain an exact npm lockfile; no runtime registry/CDN.

Use near-black/white semantic colours and a System default, with a synchronous external theme bootstrap and a single localStorage appearance enum. Motion needs dynamic style attributes; allow those through style-src-attr only, retaining self-only stylesheets and scripts, no eval or inline scripts. No user content is interpreted as style or HTML.

Login is a labelled visual preview with disabled credential fields. It neither submits nor grants identity. Keep all production services and phase gates unchanged. Port 4173 remains loopback-only. The requested private Vercel dashboard could not be fetched; the design uses its public visual language rather than claiming access to the user's dashboard.

Build with `npm run build:review`; run `npm run preview` to build/start. Revert by restoring previous review sources/package lock and rebuilding; there is no production migration. See `docs/ui-sources.md` for component provenance.
