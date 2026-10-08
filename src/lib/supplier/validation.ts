// Server-side validation for supplier applications. Pure (zod only), unit tested.
// The email, status and storage path never come from the browser.

import { z } from 'zod';
import { SUPPLIER_APPLICATION_MAX_FILE_MB } from '@/config/shop';

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}`)
    .max(max, `The ${label} must be ${max} characters or fewer`);

/** BRN as stored: trimmed and uppercase. */
export function normaliseBrn(value: string): string {
  return value.trim().toUpperCase();
}

export const supplierApplicationSchema = z.object({
  company: text('company name', 100),
  contact: text('contact person', 100),
  phone: z
    .string()
    .trim()
    .min(1, 'Enter a phone number')
    .regex(/^[0-9+\- ]{7,20}$/, 'Use 7 to 20 digits, spaces, + or -'),
  address: text('address', 255),
  country: text('country', 60),
  brn: z
    .string()
    .transform(normaliseBrn)
    .pipe(
      z
        .string()
        .min(1, 'Enter the BRN number')
        .regex(/^[A-Z0-9\-/]{5,30}$/, 'Use 5 to 30 letters, digits, hyphens or slashes'),
    ),
  products: z
    .string()
    .trim()
    .min(20, 'Describe what you would supply in at least 20 characters')
    .max(500, 'Keep the description to 500 characters or fewer'),
});

export type SupplierApplicationInput = z.output<typeof supplierApplicationSchema>;

/* ------------------------------- BRN document ------------------------------- */

export const MAX_DOCUMENT_BYTES = SUPPLIER_APPLICATION_MAX_FILE_MB * 1024 * 1024;
export const DOCUMENT_TYPE_MESSAGE = 'Please upload a PDF, JPG or PNG file';

type Kind = 'pdf' | 'jpg' | 'png';

const KINDS: Record<Kind, { mime: string; extensions: string[]; magic: number[] }> = {
  pdf: { mime: 'application/pdf', extensions: ['pdf'], magic: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  jpg: { mime: 'image/jpeg', extensions: ['jpg', 'jpeg'], magic: [0xff, 0xd8, 0xff] },
  png: { mime: 'image/png', extensions: ['png'], magic: [0x89, 0x50, 0x4e, 0x47] },
};

export interface DocumentInfo {
  name: string;
  size: number;
  type: string;
}

export type DocumentCheck = { ok: true; extension: Kind; contentType: string } | { ok: false; message: string };

function kindFromBytes(head: Uint8Array): Kind | null {
  for (const [kind, spec] of Object.entries(KINDS) as [Kind, (typeof KINDS)[Kind]][]) {
    if (spec.magic.every((b, i) => head[i] === b)) return kind;
  }
  return null;
}

/**
 * Size, extension, MIME type and content (magic bytes) must all agree on PDF, JPEG or PNG.
 * `head` is the first bytes of the file (8 are enough).
 */
export function checkDocument(file: DocumentInfo | null, head: Uint8Array): DocumentCheck {
  if (!file || !file.name) return { ok: false, message: 'Attach your BRN document' };
  if (file.size <= 0) return { ok: false, message: 'The file is empty. Please choose another file' };
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { ok: false, message: `The file must be ${SUPPLIER_APPLICATION_MAX_FILE_MB} MB or smaller` };
  }
  const extension = (file.name.split('.').pop() ?? '').toLowerCase();
  const kind = kindFromBytes(head);
  if (!kind) return { ok: false, message: DOCUMENT_TYPE_MESSAGE };
  const spec = KINDS[kind];
  if (!spec.extensions.includes(extension) || file.type.toLowerCase() !== spec.mime) {
    return { ok: false, message: DOCUMENT_TYPE_MESSAGE };
  }
  return { ok: true, extension: kind, contentType: spec.mime };
}
