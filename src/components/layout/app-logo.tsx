import Image from 'next/image';

import { cn } from '@/lib/utils';

/**
 * The Ministry of Culture mark.
 *
 * Rendered on a white tile rather than bare. The source is a JPEG with a light
 * textured background baked in — it has no alpha to knock out — so on the dark
 * theme it would otherwise sit as a pale rectangle against a dark surface. A
 * deliberate white tile reads as intentional; an accidental one does not.
 *
 * `logo-mark.png` is the artwork cropped to its bounding box. The original is a
 * 1080² frame roughly 60% empty margin, which at 32px leaves the mark too small
 * to recognise.
 */
export function AppLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex aspect-square shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white p-1',
        className
      )}
    >
      <Image
        src='/logo-mark.png'
        alt='وزارة الثقافة'
        width={400}
        height={282}
        priority
        className='h-full w-full object-contain'
      />
    </div>
  );
}

/** Product name, kept next to the mark so the two cannot drift apart. */
export const APP_NAME = 'وزارة الثقافة';
export const APP_TAGLINE = 'سجل الجمعيات الثقافية';
