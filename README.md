# Moto Hub: Client Side (customer storefront)

Customer-facing web app for the Motorbike Sales and Servicing Management System.
It reads the same Supabase database as the Flask Admin Panel and the Supplier Portal,
but only through public, read-only catalogue views.

Phase 1 (this version): guests can browse and search spare parts, motorcycles and
workshop services, and shop by their bike. There is no login, cart or payment yet;
`/login` and `/cart` are "coming soon" pages.

## Stack

Next.js 16 (App Router, Turbopack) with TypeScript (strict), Tailwind CSS v4,
`@supabase/ssr` + `@supabase/supabase-js`, and `lucide-react` icons.

## Run it

Requires Node.js 20.9 or newer.

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev                  # http://localhost:3000
```

Other scripts: `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm start`.

## Environment variables

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Also used to allow `next/image` remote images from `/storage/v1/object/public/**` on that host only. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public (publishable/anon) key. |

Only the public key is used. Never put the service-role (secret) key in this project.
`.env.local` is git-ignored; only `.env.example` is committed.

## Database contract

The app may query only these objects (all readable by `anon` and `authenticated`):

- Views: `catalog_brands`, `catalog_categories`, `catalog_models`, `catalog_services`,
  `catalog_part_variants`, `catalog_part_products`, `catalog_bikes`, `catalog_bike_models`
- RPC: `catalog_parts_for_bike(p_model_id, p_year)`

Base tables (`Stock`, `New_MotorBike`, `Supplier_Product`, `Customer`, ...) are not
readable with the public key. Database changes are applied by the project owner, never
by this app.

## Folder map

```
src/
  proxy.ts                    Supabase session refresh on every request (Next 16 "proxy")
  app/                        routes: /, /parts, /parts/[partId], /bikes, /bikes/[modelId],
                              /services, /login, /cart, plus loading, error and not-found UI
  components/
    layout/                   header, mobile menu, search box, footer
    catalog/                  cards, vehicle finder, filters, sort links, trust strip
    ui/                       image with placeholder, badges, pagination, empty states, skeletons
  config/shop.ts              shop constants (currency, page size, delivery text, deposit %)
  lib/
    supabase/                 browser, server and proxy clients (publishable key only)
    catalog/                  server-only data access for the views and RPC
    params.ts                 validated URL parameter parsing and canonical URLs
    format.ts, labels.ts      money, ranges and display helpers
  types/catalog.ts            hand-written types matching the views
```

## Conventions

- Pages are Server Components and render dynamically (stock changes often); data access
  lives in `src/lib/catalog/*` (marked `server-only`), never inside page JSX.
- All filters, search, sort and page live in the URL. `lib/params.ts` whitelists sort keys,
  clamps pages and ignores malformed values. Search text is escaped for `ILIKE` and capped
  at 60 characters; no PostgREST `.or()` string is ever built from user input.
- Descriptions are rendered as plain text. Customers never see buying prices, VINs or
  staff-only fields.
