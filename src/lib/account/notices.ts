// Whitelisted one-off messages passed as ?notice=<key> after a redirect.
// Unknown keys are ignored, so the URL can never inject text into the page.

const NOTICES = {
  'profile-created': 'Your profile has been created.',
  'profile-linked': 'We found your existing customer record and linked it to your account.',
  'password-reset': 'Your password has been reset and you are signed in.',
  'password-unchanged': 'That is already your password, so nothing changed. You are signed in.',
  'bike-added': 'Your bike has been added to your garage.',
  'bike-updated': 'Your bike has been updated.',
  'bike-deleted': 'Your bike has been removed from your garage.',
  'order-cancelled': 'The order has been cancelled. Nothing was charged.',
  'order-not-cancelled': 'This order can no longer be cancelled here. If you paid, please contact the dealership.',
} as const;

export function noticeText(value: string | string[] | undefined): string | null {
  const key = Array.isArray(value) ? value[0] : value;
  return key && key in NOTICES ? NOTICES[key as keyof typeof NOTICES] : null;
}
