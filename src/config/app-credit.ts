/**
 * Who built the system, and the rights line — in one place.
 *
 * The same wording appears on the sign-in panel, in the sidebar footer and in
 * the margin box of every printed report page. Those are three different
 * renderers — a Server Component, a Client Component, and a raw HTML string
 * handed to headless Chromium — so the text cannot live inside a component and
 * be shared. It lives here instead, and a change lands on all three at once.
 */
export const APP_CREDIT = {
  /** Label above the name. Deliberately quiet so the name carries the weight. */
  role: 'تطوير وإشراف',
  name: 'ديانا دلكي',
  directorate: 'مديرية ثقافة اربد',
  department: 'قسم الهيئات',
  rightsReserved: 'جميع الحقوق محفوظة'
} as const;

/** `مديرية ثقافة اربد — قسم الهيئات`, the affiliation as one line. */
export const APP_CREDIT_AFFILIATION = `${APP_CREDIT.directorate} — ${APP_CREDIT.department}`;

/**
 * The year on the rights line, read at render time so it never goes stale.
 *
 * Callers render it as `<span dir='ltr'>© {year}</span>` rather than folding it
 * into the Arabic string: `©` and the digits are bidi-neutral, and inside an RTL
 * paragraph an unmarked `© 2026 —` prefix gets reordered to the far end of the
 * line. The explicit LTR island pins the mark and its year together at the start.
 */
export function copyrightYear(): number {
  return new Date().getFullYear();
}
