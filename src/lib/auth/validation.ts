// Server-side validation schemas for every account form. Lenient where the database is
// the real authority (uniqueness, exact lengths); strict where we can help the user early.
// Depends only on zod so it can be unit-tested with Node's test runner (tests/).

import { z } from 'zod';

export type FieldErrors = Partial<Record<string, string>>;

/** First error message per field, keyed by the top-level field name. */
export function fieldErrorsFrom(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Reads string fields from FormData (missing or non-string values become ""). */
export function readForm<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const v = formData.get(key);
    out[key] = typeof v === 'string' ? v : '';
  }
  return out;
}

const PASSWORD_MAX = 72;
export const BIKE_MIN_YEAR = 1950;
export const bikeMaxYear = () => new Date().getFullYear() + 1;

/* ------------------------------- Primitives ------------------------------- */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .max(100, 'Email must be 100 characters or fewer')
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'));

export const newPasswordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(PASSWORD_MAX, `Use ${PASSWORD_MAX} characters or fewer`)
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/\d/, 'Include at least one number');

const existingPasswordSchema = z
  .string()
  .min(1, 'Enter your password')
  .max(PASSWORD_MAX, `Use ${PASSWORD_MAX} characters or fewer`);

export const otpSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, ''))
  .pipe(z.string().regex(/^\d{6}$/, 'Enter the 6-digit code from the email'));

function nameSchema(label: string) {
  return z
    .string()
    .trim()
    .transform((s) => s.replace(/\s+/g, ' '))
    .pipe(
      z
        .string()
        .min(1, `Enter your ${label}`)
        .max(50, `${label[0].toUpperCase()}${label.slice(1)} must be 50 characters or fewer`)
        .regex(/^[\p{L}][\p{L} '’-]*$/u, 'Use letters, spaces, hyphens and apostrophes only'),
    );
}

const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Enter your phone number')
  .regex(/^[0-9+\- ]{7,20}$/, 'Use 7 to 20 digits, spaces, + or -');

const nicSchema = z
  .string()
  .trim()
  .min(1, 'Enter your NIC number')
  .regex(/^[A-Za-z0-9]{8,20}$/, 'Use 8 to 20 letters and digits, no spaces')
  .transform((s) => s.toUpperCase());

function requiredText(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `Enter your ${label}`)
    .max(max, `${label[0].toUpperCase()}${label.slice(1)} must be ${max} characters or fewer`);
}

function optionalText(label: string, max: number) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((s) => (s === '' ? null : s));
}

function passwordsMatch(d: { password: string; confirmPassword: string }) {
  return d.password === d.confirmPassword;
}
const mismatch = { path: ['confirmPassword'], message: 'Passwords do not match' };

/* ------------------------------ Auth schemas ------------------------------ */

export const registerSchema = z
  .object({ email: emailSchema, password: newPasswordSchema, confirmPassword: z.string() })
  .refine(passwordsMatch, mismatch);

export const loginSchema = z.object({ email: emailSchema, password: existingPasswordSchema });

export const verifySchema = z.object({ email: emailSchema, code: otpSchema });

export const emailOnlySchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: otpSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, mismatch);

export const changePasswordSchema = z
  .object({
    currentPassword: existingPasswordSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine(passwordsMatch, mismatch)
  .refine((d) => d.password !== d.currentPassword, {
    path: ['password'],
    message: 'Choose a password that is different from your current one',
  });

/* ---------------------------- Profile schemas ----------------------------- */

const contactFields = {
  firstName: nameSchema('first name'),
  lastName: nameSchema('last name'),
  phone: phoneSchema,
  street: requiredText('street', 50),
  town: requiredText('town', 60),
  homeNumber: optionalText('Home number', 20),
  postCode: optionalText('Post code', 10),
};

export const profileCreateSchema = z.object({ ...contactFields, nic: nicSchema });
export const profileUpdateSchema = z.object(contactFields);

export const PROFILE_CREATE_FIELDS = [
  'firstName',
  'lastName',
  'phone',
  'nic',
  'street',
  'town',
  'homeNumber',
  'postCode',
] as const;
export const PROFILE_UPDATE_FIELDS = PROFILE_CREATE_FIELDS.filter((f) => f !== 'nic');

/* ------------------------------ Bike schemas ------------------------------ */

const registrationSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{1,6}$/, 'Use 1 to 6 letters and digits'));

const yearSchema = z
  .string()
  .trim()
  .regex(/^\d{4}$/, 'Enter a 4-digit year')
  .transform(Number)
  .refine((y) => y >= BIKE_MIN_YEAR && y <= bikeMaxYear(), {
    message: `Enter a year between ${BIKE_MIN_YEAR} and next year`,
  });

const vinSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, '').toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9]{5,50}$/, 'Use 5 to 50 letters and digits'));

const modelIdSchema = z
  .string()
  .regex(/^\d{1,9}$/, 'Choose your model')
  .transform(Number);

export const bikeAddSchema = z.object({
  modelId: modelIdSchema,
  registration: registrationSchema,
  year: yearSchema,
  vin: vinSchema,
});

export const bikeEditSchema = z.object({ registration: registrationSchema, year: yearSchema });

export const bikeIdSchema = z.string().regex(/^\d{1,9}$/).transform(Number);
