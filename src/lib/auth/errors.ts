// Maps Supabase Auth and PostgREST errors to friendly, non-revealing messages.
// Pure (no imports) so it can be unit-tested with fake error objects (tests/).

type FieldErrors = Partial<Record<string, string>>;

export interface ErrorLike {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  status?: number;
}

export interface Mapped {
  message?: string;
  fieldErrors?: FieldErrors;
}

const TOO_MANY = 'Too many attempts. Please wait a minute and try again.';
const TOO_LONG = 'One of the values is too long.';

function isRateLimit(e: ErrorLike): boolean {
  return (
    e.code === 'over_email_send_rate_limit' ||
    e.code === 'over_request_rate_limit' ||
    e.status === 429
  );
}

/* --------------------------------- Auth ---------------------------------- */

/** signUp: existing accounts are reported as "neutral" so they look like success. */
export function mapSignUpError(e: ErrorLike): Mapped | 'neutral' {
  if (e.code === 'user_already_exists' || e.code === 'email_exists') return 'neutral';
  if (isRateLimit(e)) return { message: TOO_MANY };
  if (e.code === 'weak_password') {
    return { fieldErrors: { password: 'Choose a stronger password: at least 8 characters with letters and numbers.' } };
  }
  if (e.code === 'email_address_invalid') return { fieldErrors: { email: 'Enter a valid email address' } };
  if (e.code === 'signup_disabled') return { message: 'New registrations are paused at the moment.' };
  return { message: 'We could not create your account right now. Please try again.' };
}

/** signInWithPassword: everything except "not confirmed" and rate limits is generic. */
export function mapLoginError(e: ErrorLike): Mapped | 'unconfirmed' {
  if (e.code === 'email_not_confirmed' || /email not confirmed/i.test(e.message ?? '')) return 'unconfirmed';
  if (isRateLimit(e)) return { message: TOO_MANY };
  return { message: 'Incorrect email or password.' };
}

/** verifyOtp (signup or recovery). Wrong and expired codes return the same error. */
export function mapOtpError(e: ErrorLike): Mapped {
  if (isRateLimit(e)) return { message: TOO_MANY };
  return {
    fieldErrors: {
      code: 'This code is wrong or has expired. Check the latest email or request a new code.',
    },
  };
}

/** resend / resetPasswordForEmail: only rate limits are reported. */
export function mapEmailSendError(e: ErrorLike): Mapped | 'neutral' {
  if (isRateLimit(e)) return { message: 'Please wait a minute before requesting another code.' };
  return 'neutral';
}

/** updateUser({ password }). */
export function mapUpdatePasswordError(e: ErrorLike): Mapped {
  if (e.code === 'same_password') {
    return { fieldErrors: { password: 'Your new password must be different from your current password.' } };
  }
  if (e.code === 'weak_password') {
    return { fieldErrors: { password: 'Choose a stronger password: at least 8 characters with letters and numbers.' } };
  }
  if (e.code === 'reauthentication_needed' || e.code === 'reauthentication_not_valid') {
    return { message: 'For your security, please sign out, sign in again and retry.' };
  }
  if (isRateLimit(e)) return { message: TOO_MANY };
  return { message: 'We could not change your password right now. Please try again.' };
}

/* ------------------------------ Profile RPC ------------------------------ */

const RPC_TOKENS = [
  'NIC_OR_PHONE_ALREADY_REGISTERED',
  'NIC_ALREADY_REGISTERED',
  'PHONE_ALREADY_REGISTERED',
  'ALREADY_HAS_PROFILE',
  'EMAIL_NOT_VERIFIED',
  'NOT_AUTHENTICATED',
  'MISSING_FIELDS',
] as const;
export type RpcToken = (typeof RPC_TOKENS)[number];

/** Finds the exact token in a PostgREST message (word boundaries, so no partial matches). */
export function rpcToken(message: string | null | undefined): RpcToken | null {
  const m = message ?? '';
  for (const token of RPC_TOKENS) {
    if (new RegExp(`(^|[^A-Z_])${token}($|[^A-Z_])`).test(m)) return token;
  }
  return null;
}

export const NIC_TAKEN = 'This NIC is already registered. If it is yours, please contact the dealership.';
export const PHONE_TAKEN = 'This phone number is already registered to another customer.';

export type RegisterCustomerResult = Mapped & { redirect?: 'profile' | 'login' };

/** register_customer RPC errors. */
export function mapRegisterCustomerError(e: ErrorLike): RegisterCustomerResult {
  switch (rpcToken(e.message)) {
    case 'ALREADY_HAS_PROFILE':
      return { redirect: 'profile' };
    case 'NOT_AUTHENTICATED':
      return { redirect: 'login' };
    case 'EMAIL_NOT_VERIFIED':
      return { message: 'Please confirm your email address before creating your profile.' };
    case 'MISSING_FIELDS':
      return { message: 'Please fill in all required fields.' };
    case 'NIC_ALREADY_REGISTERED':
      return { fieldErrors: { nic: NIC_TAKEN } };
    case 'PHONE_ALREADY_REGISTERED':
      return { fieldErrors: { phone: PHONE_TAKEN } };
    case 'NIC_OR_PHONE_ALREADY_REGISTERED':
      return {
        message:
          'This NIC or phone number is already registered. If they are yours, please contact the dealership.',
        fieldErrors: { nic: 'Check this NIC number', phone: 'Check this phone number' },
      };
    default:
      break;
  }
  if (e.code === '22001') return { message: TOO_LONG };
  if (e.code === '23505') {
    return {
      message: 'This NIC or phone number is already registered. If they are yours, please contact the dealership.',
    };
  }
  return { message: 'We could not save your profile right now. Please try again.' };
}

/* ---------------------------- Profile update ----------------------------- */

export function mapProfileUpdateError(e: ErrorLike): Mapped {
  const text = `${e.message ?? ''} ${e.details ?? ''}`;
  if (e.code === '23505') {
    if (/phone/i.test(text)) return { fieldErrors: { phone: PHONE_TAKEN } };
    return { message: 'One of these details is already registered to another customer.' };
  }
  if (e.code === '22001') return { message: TOO_LONG };
  if (/Customers may only change their contact details/i.test(text)) {
    return { message: 'Only your contact details can be changed here.' };
  }
  if (e.code === '42501') return { message: 'You are not allowed to change this profile.' };
  return { message: 'We could not save your profile right now. Please try again.' };
}

/* --------------------------------- Bikes --------------------------------- */

export const BIKE_TAKEN =
  'This VIN or registration number is already registered. If this is your bike, please contact the dealership.';
export const BIKE_HAS_APPOINTMENTS = 'This bike has appointments and cannot be deleted.';

export function mapBikeError(op: 'add' | 'edit' | 'delete', e: ErrorLike): Mapped {
  const text = `${e.message ?? ''} ${e.details ?? ''}`;
  if (e.code === '23505') return { message: BIKE_TAKEN };
  if (e.code === '23503') {
    return op === 'delete'
      ? { message: BIKE_HAS_APPOINTMENTS }
      : { fieldErrors: { modelId: 'Choose a model from the list' } };
  }
  if (e.code === '22001') return { message: TOO_LONG };
  if (/Customers may only change the registration number and year of a bike/i.test(text)) {
    return { message: 'Only the registration number and year can be changed.' };
  }
  if (e.code === '42501') return { message: 'You cannot change this bike.' };
  return { message: 'We could not save this bike right now. Please try again.' };
}
