# Moto Hub: Client Side (customer storefront)

Customer-facing web app for the Motorbike Sales and Servicing Management System.
It reads the same Supabase database as the Flask Admin Panel and the Supplier Portal,
but only through public, read-only catalogue views.

- Phase 1: guests browse and search spare parts, motorcycles and workshop services,
  and shop by their bike.
- Phase 2: customer accounts. Registration with a 6-digit email code, sign in (email and
  password, optional Google), password reset, a customer profile (which can claim an
  existing walk-in customer record by NIC and email) and a garage for the customer's bikes.

Cart, checkout and appointments are not built yet (`/cart` is a "coming soon" page).

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

Other scripts:

| Script | Purpose |
|---|---|
| `npm run lint`, `npx tsc --noEmit`, `npm run build`, `npm start` | Quality checks, production build and server |
| `npm test` | Unit tests for validation, error mapping and the open-redirect guard (Node test runner) |
| `npm run check:rls` | Signs in as a test customer and checks the database rules (see below) |

## Environment variables

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Also used to allow `next/image` remote images from `/storage/v1/object/public/**` on that host only. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public (publishable/anon) key. |
| `NEXT_PUBLIC_SITE_URL` | Absolute site origin for auth redirect links. Default `http://localhost:3000`. |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | `true` shows "Continue with Google". Default `false` (button hidden). |
| `TEST_EMAIL`, `TEST_PASSWORD`, `OTHER_CUSTOMER_ID` | Only for `npm run check:rls`. Never commit real values. |

Only the public key is used. Never put the service-role (secret) key in this project.
`.env.local` is git-ignored; only `.env.example` is committed.

## Auth setup (Supabase dashboard)

These settings are made by the project owner in the Supabase dashboard; the app does not
change them. Re-apply them when setting the project up again:

- **Email provider:** enabled, with **Confirm email** turned on.
- **Password:** minimum length 8. The app also requires 8 to 72 characters with a letter and a number.
- **Email templates:** "Confirm signup" and "Reset password" contain the 6-digit code
  `{{ .Token }}` (customers type the code; no magic links are needed).
- **SMTP:** a custom SMTP server, so codes are delivered reliably and rate limits are reasonable.
- **URL configuration:** Site URL `http://localhost:3000`, redirect URL `http://localhost:3000/**`
  (add the production URL and `<site>/**` when deploying, and set `NEXT_PUBLIC_SITE_URL`).
- **Google (optional):** enable the Google provider with a Google OAuth client whose
  authorised redirect URI is `https://<project-ref>.supabase.co/auth/v1/callback`, then set
  `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`. The app returns through `/auth/callback`.

### Customer RLS check

`npm run check:rls` signs in as a test customer (public key only) and prints PASS or FAIL
for: own `Customer` row only; no access to staff tables; contact-only updates; no direct
`Customer` inserts; own bikes only; registration/year-only bike updates; bike delete
(it cleans up the bike it creates); and `register_customer` refusing a second profile.
Create a confirmed test customer with a completed profile first, then:

```bash
TEST_EMAIL=you+test@example.com TEST_PASSWORD='...' npm run check:rls
```

The script also reads `.env.local` (put `TEST_EMAIL` and `TEST_PASSWORD` there if you prefer).

## Database contract

The app may query only these objects (all readable by `anon` and `authenticated`):

- Views: `catalog_brands`, `catalog_categories`, `catalog_models`, `catalog_services`,
  `catalog_part_variants`, `catalog_part_products`, `catalog_bikes`, `catalog_bike_models`
- RPC: `catalog_parts_for_bike(p_model_id, p_year)`

Signed-in customers (role `authenticated`, under RLS):

- `Customer`: read and update only their own row (linked by `AuthUserID`, which the app
  filters on but never selects); only contact fields can change; no direct inserts.
- `Customer_bike`: full access to their own bikes; only `RegistrationNumber` and `Year` can change.
- RPC `register_customer(...)`: creates the profile or claims a matching walk-in record. The
  email comes from the verified login, never from the form.

Base tables (`Stock`, `New_MotorBike`, `Supplier_Product`, `Customer`, ...) are not
readable with the public key. Database changes are applied by the project owner, never
by this app.

## Folder map

```
src/
  proxy.ts                    session refresh + convenience redirects (Next 16 "proxy")
  app/                        routes: /, /parts, /parts/[partId], /bikes, /bikes/[modelId],
                              /services, /cart, plus loading, error and not-found UI
    login, register, verify, forgot-password, reset-password, auth/callback
    account/                  overview, profile (+ complete), security, garage (new, edit)
  components/
    layout/                   header, mobile menu, search box, footer
    catalog/                  cards, vehicle finder, filters, sort links, trust strip
    ui/                       image with placeholder, badges, pagination, empty states, skeletons
    forms/                    field, message, submit button, focus-on-error hook
    account/                  auth, profile and garage forms, account navigation
  config/shop.ts              shop constants (currency, page size, delivery text, deposit %)
  lib/
    supabase/                 browser, server and proxy clients (publishable key only)
    catalog/                  server-only data access for the views and RPC
    auth/                     config, session helpers, zod schemas, error mapping, safeNext()
    actions/                  Server Actions: auth, profile, garage
    account/                  garage data and notices
    params.ts                 validated URL parameter parsing and canonical URLs
    format.ts, labels.ts      money, ranges and display helpers
  types/catalog.ts            hand-written types matching the views
scripts/customer-rls-check.mjs  live RLS check (npm run check:rls)
tests/                          unit tests (npm test)
```

## Conventions

- Pages are Server Components and render dynamically (stock changes often); data access
  lives in `src/lib/catalog/*` (marked `server-only`), never inside page JSX.
- All filters, search, sort and page live in the URL. `lib/params.ts` whitelists sort keys,
  clamps pages and ignores malformed values. Search text is escaped for `ILIKE` and capped
  at 60 characters; no PostgREST `.or()` string is ever built from user input.
- Descriptions are rendered as plain text. Customers never see buying prices, VINs of
  dealership stock or staff-only fields.
- Every state change is a Server Action validated with zod. Account pages and actions call
  `requireUser()` / `requireCustomer()`; the proxy redirects are a convenience only.
- `next` redirect targets go through `safeNext()` (same-site paths only).
- Auth responses never reveal whether an email has an account. Passwords, codes and tokens
  are never logged, echoed back or put in URLs.
