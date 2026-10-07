'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/components/cart/CartProvider';

const CLEARED_KEY = 'motohub-cart-cleared-orders';

/** Clears the cart once per paid order (revisiting the page later does not wipe a new cart). */
export function ClearCartOnce({ orderId }: { orderId: number }) {
  const { clear, ready } = useCart();
  useEffect(() => {
    if (!ready) return;
    try {
      const done = JSON.parse(window.localStorage.getItem(CLEARED_KEY) ?? '[]') as unknown;
      const list = Array.isArray(done) ? done.filter((n): n is number => typeof n === 'number') : [];
      if (list.includes(orderId)) return;
      clear();
      window.localStorage.setItem(CLEARED_KEY, JSON.stringify([...list, orderId].slice(-20)));
    } catch {
      clear();
    }
  }, [orderId, clear, ready]);
  return null;
}

/**
 * While the webhook confirms the payment, re-renders the server page every 2 seconds for
 * about 30 seconds, then shows a reassuring message instead.
 */
export function AwaitPaymentConfirmation({
  intervalMs = 2000,
  attempts = 15,
  what = 'order',
}: {
  intervalMs?: number;
  attempts?: number;
  /** What is being finalised, for the message ("order" or "reservation"). */
  what?: 'order' | 'reservation';
}) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const done = tries >= attempts;

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => {
      setTries((n) => n + 1);
      router.refresh();
    }, intervalMs);
    return () => clearTimeout(t);
  }, [tries, done, intervalMs, router]);

  return (
    <p role="status" aria-live="polite" className="text-sm text-ink-muted">
      {done
        ? `We have received your payment and are finalising your ${what}. It will appear in My orders shortly.`
        : 'Confirming your payment with the bank. This usually takes a few seconds...'}
    </p>
  );
}
