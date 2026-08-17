import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

/** Derived from the config type rather than imported from `next/dist` internals. */
type RemotePattern = NonNullable<NonNullable<NextConfig['images']>['remotePatterns']>[number];

/**
 * Allows `next/image` to load from a self-hosted Supabase.
 *
 * Hosted Supabase always answers on `https://<ref>.supabase.co`, which the
 * static pattern below covers. A self-hosted stack on a ministry LAN answers on
 * something like `http://10.0.0.5:8000` instead — a different scheme, host and
 * port — and the optimizer rejects any remote URL it was not told about, so
 * every signed storage preview 400s. Deriving the pattern from the URL the app
 * was built against keeps the two in step: there is no second variable to
 * forget, and on Vercel this returns nothing at all.
 *
 * Read at build time, which is correct — `remotePatterns` is baked into the
 * build, and so is the client's copy of NEXT_PUBLIC_SUPABASE_URL.
 */
function selfHostedSupabasePattern(): RemotePattern[] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return [];

  try {
    const { protocol, hostname, port } = new URL(raw);
    if (protocol !== 'http:' && protocol !== 'https:') return [];
    // Already covered by the wildcard entry below.
    if (hostname.endsWith('.supabase.co')) return [];

    return [{ protocol: protocol === 'http:' ? 'http' : 'https', hostname, port }];
  } catch {
    // A malformed URL is the app's problem to report at runtime, not a reason
    // to fail the build here.
    return [];
  }
}

// Define the base Next.js configuration
const baseConfig: NextConfig = {
  output: process.env.BUILD_STANDALONE === 'true' ? 'standalone' : undefined,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.slingacademy.com',
        port: ''
      },
      {
        // Supabase Storage signed URLs (public-object URLs and signed reads
        // both live under this host). Narrow to your own project ref if you
        // prefer: '<project-ref>.supabase.co'.
        protocol: 'https',
        hostname: '*.supabase.co',
        port: ''
      },
      ...selfHostedSupabasePattern()
    ]
  },
  transpilePackages: ['geist'],
  /**
   * Kept out of the server bundle and `require`d at runtime instead.
   *
   * `@sparticuz/chromium` resolves a Chromium binary relative to its own package
   * directory, and `puppeteer-core` loads native protocol helpers the same way.
   * Bundling either rewrites those paths and the PDF route fails at launch with
   * a missing-executable error that only appears once deployed.
   */
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  }
};

let configWithPlugins = baseConfig;

// Conditionally enable Sentry configuration
if (!process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
  configWithPlugins = withSentryConfig(configWithPlugins, {
    org: process.env.NEXT_PUBLIC_SENTRY_ORG,
    project: process.env.NEXT_PUBLIC_SENTRY_PROJECT,
    // Only print logs for uploading source maps in CI
    silent: !process.env.CI,

    // Upload a larger set of source maps for prettier stack traces (increases build time)
    widenClientFileUpload: true,

    // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
    tunnelRoute: '/monitoring',

    // Disable Sentry telemetry
    telemetry: false,

    // Sentry v10: moved under webpack namespace
    webpack: {
      reactComponentAnnotation: {
        enabled: true
      },
      treeshake: {
        removeDebugLogging: true
      }
    },

    // Disable source map upload when org/project are not configured
    sourcemaps: {
      disable: !process.env.NEXT_PUBLIC_SENTRY_ORG || !process.env.NEXT_PUBLIC_SENTRY_PROJECT
    }
  });
}

const nextConfig = configWithPlugins;
export default nextConfig;
