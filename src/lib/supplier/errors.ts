// Maps submit_supplier_application errors to what the applicant should see.

interface ErrorLike {
  code?: string | null;
  message?: string | null;
}

const TOKENS = [
  'NOT_AUTHENTICATED',
  'EMAIL_NOT_VERIFIED',
  'ALREADY_SUPPLIER',
  'ALREADY_PENDING',
  'TOO_MANY_APPLICATIONS',
  'MISSING_FIELDS',
  'INVALID_DOCUMENT',
  'BRN_ALREADY_REGISTERED',
] as const;

export const APPLICATION_MESSAGES = {
  alreadyPending: 'You already have an application under review. You will see the result on this page.',
  tooMany: 'You have used all 3 online applications. Please contact the dealership.',
  alreadySupplier: 'This account is already linked to a supplier. Sign in to the Supplier Portal instead.',
  brnRegistered:
    'This business registration number has already been submitted or registered. If this is a mistake, please contact the dealership.',
  missingFields: 'Please fill in all the required fields.',
  invalidDocument: 'Your document could not be attached. Please choose the file again.',
  tooLong: 'One of the values is too long.',
  generic: 'We could not submit your application right now. Please try again.',
} as const;

export type ApplicationOutcome =
  | { kind: 'login' }
  | { kind: 'verify' }
  | { kind: 'error'; message: string; field?: 'brn' | 'document' };

export function mapApplicationError(e: ErrorLike): ApplicationOutcome {
  const m = e.message ?? '';
  const token = TOKENS.find((t) => new RegExp(`(^|[^A-Z_])${t}($|[^A-Z_])`).test(m));
  switch (token) {
    case 'NOT_AUTHENTICATED':
      return { kind: 'login' };
    case 'EMAIL_NOT_VERIFIED':
      return { kind: 'verify' };
    case 'ALREADY_PENDING':
      return { kind: 'error', message: APPLICATION_MESSAGES.alreadyPending };
    case 'TOO_MANY_APPLICATIONS':
      return { kind: 'error', message: APPLICATION_MESSAGES.tooMany };
    case 'ALREADY_SUPPLIER':
      return { kind: 'error', message: APPLICATION_MESSAGES.alreadySupplier };
    case 'BRN_ALREADY_REGISTERED':
      return { kind: 'error', message: APPLICATION_MESSAGES.brnRegistered, field: 'brn' };
    case 'MISSING_FIELDS':
      return { kind: 'error', message: APPLICATION_MESSAGES.missingFields };
    case 'INVALID_DOCUMENT':
      return { kind: 'error', message: APPLICATION_MESSAGES.invalidDocument, field: 'document' };
    default:
      break;
  }
  if (e.code === '22001') return { kind: 'error', message: APPLICATION_MESSAGES.tooLong };
  return { kind: 'error', message: APPLICATION_MESSAGES.generic };
}
