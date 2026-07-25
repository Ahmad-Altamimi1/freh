import { z } from 'zod';

/**
 * Environment variable access, validated with zod.
 *
 * Validation is lazy and memoized rather than run at import time so that
 * importing a module never crashes a build that has not been given secrets yet.
 * The error surfaces the first time a client actually needs the value, with a
 * message that names the missing variable.
 *
 * NEXT_PUBLIC_* values must be referenced as literal `process.env.X` member
 * expressions for Next.js to inline them into the client bundle — never
 * destructure or index into `process.env` for those.
 */

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default('private'),
  /** Shared secret the term-notifications cron route checks against. Also the
   *  literal bearer token Vercel Cron auto-sends when a project env var is
   *  named exactly `CRON_SECRET`. */
  CRON_SECRET: z.string().min(1),
  /** Days before `term_end` to start notifying admins. */
  TERM_END_NOTICE_DAYS: z.coerce.number().int().positive().default(10)
});

type PublicEnv = z.infer<typeof publicEnvSchema>;
type ServerEnv = z.infer<typeof serverEnvSchema>;

function formatIssues(scope: string, error: z.ZodError): never {
  const missing = error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
  throw new Error(
    `Invalid ${scope} environment variables:\n${missing.join('\n')}\n\n` +
      `Copy env.example.txt to .env.local and fill in the values from your Supabase project settings.`
  );
}

let cachedPublicEnv: PublicEnv | undefined;
let cachedServerEnv: ServerEnv | undefined;

export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv;

  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });

  if (!parsed.success) formatIssues('public', parsed.error);

  cachedPublicEnv = parsed.data;
  return cachedPublicEnv;
}

export function getServerEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error(
      'getServerEnv() was called in the browser. Server secrets must never be bundled for the client.'
    );
  }
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
    CRON_SECRET: process.env.CRON_SECRET,
    TERM_END_NOTICE_DAYS: process.env.TERM_END_NOTICE_DAYS
  });

  if (!parsed.success) formatIssues('server', parsed.error);

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}
