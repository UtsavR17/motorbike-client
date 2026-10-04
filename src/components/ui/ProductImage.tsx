'use client';

import Image from 'next/image';
import { Bike, Package } from 'lucide-react';
import { useState } from 'react';
import { publicStoragePrefix } from '@/lib/supabase/env';

interface ProductImageProps {
  src: string | null | undefined;
  alt: string;
  kind?: 'part' | 'bike';
  sizes?: string;
  className?: string;
  preload?: boolean;
}

/** Only images from this project's public Supabase storage are rendered. */
function isAllowedSource(src: string | null | undefined): src is string {
  const prefix = publicStoragePrefix();
  return Boolean(src && prefix && src.startsWith(prefix));
}

/**
 * Square-ish product image that fills its (relatively positioned) parent.
 * Falls back to a neutral placeholder when there is no image, the URL is not
 * from the storage host, or the image fails to load.
 */
export function ProductImage({
  src,
  alt,
  kind = 'part',
  sizes = '(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw',
  className = '',
  preload = false,
}: ProductImageProps) {
  const [failed, setFailed] = useState(false);

  if (!isAllowedSource(src) || failed) {
    const Icon = kind === 'bike' ? Bike : Package;
    return (
      <div
        role="img"
        aria-label={`${alt} (no photo yet)`}
        className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-page to-line/60 text-ink-muted ${className}`}
      >
        <Icon aria-hidden="true" className="h-10 w-10" strokeWidth={1.5} />
        <span className="text-xs font-medium">Photo coming soon</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      preload={preload}
      onError={() => setFailed(true)}
      className={`object-contain p-4 ${className}`}
    />
  );
}
