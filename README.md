# Moto Hub: Client Side (customer storefront)

Customer-facing web app for the Motorbike Sales and Servicing Management System.
It reads the same Supabase database as the Flask Admin Panel and the Supplier Portal,
but only through public, read-only catalogue views.

- Phase 1: guests browse and search spare parts, motorcycles and workshop services,
  and shop by their bike.
- Phase 2: customer accounts. Registration with a 6-digit email code, sign in (email and
  password, optional Google), password reset, a customer profile (which can claim an
  existing walk-in customer record by NIC and email) and a garage for the customer's bikes.

- Phase 3: cart, checkout and orders for spare parts. Customers choose home delivery or
  store pickup and pay on a hosted Stripe Checkout page (test mode only); a webhook
  confirms the payment and the order appears in My orders.

- Phase 4: motorcycle reservations. A customer pays a 10% deposit online (hosted Stripe
  Checkout) to hold a specific unit for 7 days, then pays the balance and collects it at the
  dealership. The full price is never charged online.

Workshop appointments are not built yet.

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
| `npm run check:rls` | Signs in as a test customer and checks the customer/garage database rules |
| `npm run check:orders` | Signs in as a test customer and checks the online order and reservation rules (creates and cancels one test order and one test reservation) |

## Environment variables

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Also used to allow `next/image` remote images from `/storage/v1/object/public/**` on that host only. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public (publishable/anon) key. |
| `NEXT_PUBLIC_SITE_URL` | Absolute site origin for auth redirect links. Default `http://localhost:3000`. |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | `true` shows "Continue with Google". Default `false` (button hidden). |
| `TEST_EMAIL`, `TEST_PASSWORD`, `OTHER_CUSTOMER_ID` | Only for `npm run check:rls` / `check:orders`. Never commit real values. |
| `STRIPE_SECRET_KEY` | Server only. Stripe **test** secret key (`sk_test_...`). Live keys are refused. |
| `STRIPE_WEBHOOK_SECRET` | Server only. Signing secret printed by `stripe listen` (`whsec_...`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only. Used exclusively by the Stripe webhook route to confirm payments. |
| `STRIPE_CURRENCY` | `mur` (default) or `usd`. The shop always shows Rs. and stores MUR. |
| `STRIPE_MUR_PER_USD` | Only with `usd`: rupees per dollar for the conversion (default 46, a demo value). |

The browser only ever sees the public key. The three server-only secrets above live in
`.env.local` (git-ignored; only `.env.example` is committed), are read only in
`server-only` modules, and are never logged or rendered.

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

## Payments setup (Stripe test mode)

Payments use hosted Stripe Checkout in **test mode**: no Stripe.js or publishable key runs
in the browser, and no real money moves.

1. **Keys.** In the Stripe Dashboard (test mode) open Developers > API keys and copy the
   secret key (`sk_test_...`) into `STRIPE_SECRET_KEY`. Copy the Supabase service-role key
   (Project Settings > API) into `SUPABASE_SERVICE_ROLE_KEY`.
2. **Stripe CLI.** Install it, then sign in once:
   ```bash
   stripe login
   ```
3. **Forward webhooks** to the app while `npm run dev` runs (keep this terminal open):
   ```bash
   stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to localhost:3000/api/stripe/webhook
   ```
   It prints a signing secret (`whsec_...`): put it in `STRIPE_WEBHOOK_SECRET` and restart
   `npm run dev`. Recent Stripe CLI versions require `--events` (or `--all-snapshot`, which
   forwards every event; the app answers 200 and ignores the ones it does not handle).
4. **Currency.** `STRIPE_CURRENCY=mur` (Stripe accepts Mauritian rupees in test mode). Set
   `usd` only if MUR is rejected; amounts are then converted at `STRIPE_MUR_PER_USD`.

**Test cards** (any future expiry date, any CVC, any postcode):

| Card | Result |
|---|---|
| `4242 4242 4242 4242` | Payment succeeds |
| `4000 0000 0000 0002` | Card declined |
| `4000 0025 0000 3155` | Asks for 3D Secure authentication |

**How an order flows.** `/checkout` calls `create_online_order` (prices and total come from
the database) and opens a Checkout Session that expires after 30 minutes. Only the webhook
(`/api/stripe/webhook`, signature-verified) marks the order Paid, decrements stock and records
the payment via `finalize_online_order`. If the last unit sold in the meantime, the order is
cancelled and the payment refunded automatically. Abandoned or expired sessions cancel the
pending order. Useful CLI commands while testing:

```bash
stripe checkout sessions expire cs_test_...
stripe events resend evt_...
```

**How a reservation flows.** "Reserve with deposit" on a motorcycle page opens
`/reserve/<bikeId>` (sign-in and a completed profile required). After the customer ticks the
confirmation box, `create_bike_reservation` creates a Pending Payment order of type
`Reservation` with no items; the database sets the deposit (10% of the unit's price), and the
browser never sends a price. The Checkout Session has one line, "Deposit (10%): ...", with
`order_type=reservation` in its metadata. The webhook checks the charged amount against the
order's `TotalAmount` (parts orders are still checked against their items). It then calls
`finalize_online_order`, which marks the unit Sold, creates the Sale and the Deposit payment
and sets the visit-by date (payment date + 7 days). If another customer reserved the unit
first, the deposit is refunded automatically. Cancellations are handled by the dealership.

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
- Online orders: views `my_orders` and `my_order_items`; functions `create_online_order`,
  `attach_checkout_session` and `cancel_my_pending_order`. The order tables themselves are not
  readable by customers.
- Reservations: `create_bike_reservation(p_bike_id)`, plus the same `attach_checkout_session`
  and `cancel_my_pending_order`. `my_orders` adds `order_type`, `reserved_until`,
  `bike_description` and `bike_price` (never the VIN).
- Webhook only (service-role key): `finalize_online_order` and `expire_online_order`, plus a
  read of `Online_Order` (`OrderType`, `TotalAmount`) and `Online_Order_Item` to re-check
  the charged amount.

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
    account/                  overview, orders (+ detail), profile (+ complete), security, garage
    cart, checkout (+ success, cancelled), api/stripe/webhook
  components/
    layout/                   header, mobile menu, search box, footer
    catalog/                  cards, vehicle finder, filters, sort links, trust strip
    ui/                       image with placeholder, badges, pagination, empty states, skeletons
    forms/                    field, message, submit button, focus-on-error hook
    account/                  auth, profile and garage forms, account navigation
    cart/, checkout/, orders/ cart provider and view, checkout form, order badges and summaries
  config/shop.ts              shop constants (currency, page size, delivery text, deposit %)
  lib/
    supabase/                 browser, server and proxy clients (publishable key only)
    catalog/                  server-only data access for the views and RPC
    auth/                     config, session helpers, zod schemas, error mapping, safeNext()
    actions/                  Server Actions: auth, profile, garage, cart lookup, checkout
    account/                  garage and order data, notices
    cart/, checkout/          cart storage format, checkout validation and error mapping
    commerce/money.ts         MUR to Stripe minor units (toMinorUnits)
    stripe/                   server-only Stripe client (test keys only) and the webhook router
    supabase/admin.ts         service-role client: imported ONLY by the webhook route
    params.ts                 validated URL parameter parsing and canonical URLs
    format.ts, labels.ts      money, ranges and display helpers
  types/catalog.ts            hand-written types matching the views
scripts/customer-rls-check.mjs  live RLS check (npm run check:rls)
scripts/orders-rls-check.mjs    live online-order check (npm run check:orders)
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
