// Server-side validation for starting a checkout. Only stock ids, quantities, the fulfilment
// choice and delivery details come from the browser; prices never do.

import { z } from 'zod';
import { MAX_CART_LINES, MAX_LINE_QTY } from '@/config/shop';

export const FULFILMENT = ['Delivery', 'Pickup'] as const;
export type Fulfilment = (typeof FULFILMENT)[number];

const lineSchema = z.object({
  stockId: z.number().int().positive().max(2_147_483_647),
  qty: z.number().int().min(1, 'Quantity must be at least 1').max(MAX_LINE_QTY, `At most ${MAX_LINE_QTY} of each item`),
});

/** Parses the JSON lines field, merges duplicate stock ids and enforces the limits. */
export const linesSchema = z
  .string()
  .max(5000, 'Your cart could not be read')
  .transform((raw, ctx) => {
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Your cart could not be read' });
      return z.NEVER;
    }
  })
  .pipe(z.array(lineSchema).min(1, 'Your cart is empty'))
  .transform((lines, ctx) => {
    const merged = new Map<number, number>();
    for (const l of lines) merged.set(l.stockId, (merged.get(l.stockId) ?? 0) + l.qty);
    const out = [...merged].map(([stockId, qty]) => ({ stockId, qty }));
    if (out.some((l) => l.qty > MAX_LINE_QTY)) {
      ctx.addIssue({ code: 'custom', message: `At most ${MAX_LINE_QTY} of each item` });
      return z.NEVER;
    }
    if (out.length > MAX_CART_LINES) {
      ctx.addIssue({ code: 'custom', message: `At most ${MAX_CART_LINES} different items per order` });
      return z.NEVER;
    }
    return out;
  });

const optional = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((s) => (s === '' ? null : s));

export const checkoutSchema = z
  .object({
    lines: linesSchema,
    fulfilment: z.enum(FULFILMENT, 'Choose home delivery or store pickup'),
    street: optional(50, 'Street'),
    town: optional(60, 'Town'),
    postCode: optional(10, 'Post code'),
    phone: optional(20, 'Phone number'),
  })
  .superRefine((d, ctx) => {
    if (d.fulfilment !== 'Delivery') return;
    if (!d.street) ctx.addIssue({ code: 'custom', path: ['street'], message: 'Enter the delivery street' });
    if (!d.town) ctx.addIssue({ code: 'custom', path: ['town'], message: 'Enter the delivery town' });
    if (!d.phone) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a phone number for the courier' });
    else if (!/^[0-9+\- ]{7,20}$/.test(d.phone)) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Use 7 to 20 digits, spaces, + or -' });
    }
  })
  .transform((d) =>
    // Pickup orders send no address at all.
    d.fulfilment === 'Pickup' ? { ...d, street: null, town: null, postCode: null, phone: null } : d,
  );

export type CheckoutInput = z.output<typeof checkoutSchema>;

/** Order id from a URL or form value ("123" only). */
export const orderIdSchema = z
  .string()
  .regex(/^\d{1,9}$/)
  .transform(Number)
  .refine((n) => n > 0);

/** Stripe Checkout Session id from the success URL. */
export const sessionIdSchema = z.string().regex(/^cs_(test|live)_[A-Za-z0-9]{10,200}$/);

/** Motorcycle unit id (catalog_bikes.bike_id) from a URL or form value. */
export const bikeIdSchema = z
  .string()
  .regex(/^\d{1,10}$/)
  .transform(Number)
  .refine((n) => n > 0 && n <= 2_147_483_647);

/** Starting a reservation: only the bike id and the confirmation tick come from the browser. */
export const reservationSchema = z.object({
  bikeId: bikeIdSchema,
  terms: z.literal('yes', 'Tick the box to confirm you understand how the deposit works'),
});
