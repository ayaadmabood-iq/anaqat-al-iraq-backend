/**
 * Refuses to start the process when NODE_ENV=production is set with a
 * dangerous or missing configuration. This runs before Nest bootstraps so
 * an operator gets a clear message rather than a subtle mid-run failure.
 *
 * The rules are conservative on purpose: every one of them protects a
 * concrete IRPB security requirement.
 */
export interface GuardResult {
  ok: boolean;
  reasons: string[];
}

export function evaluateProductionGuards(env: NodeJS.ProcessEnv = process.env): GuardResult {
  const reasons: string[] = [];
  if (env.NODE_ENV !== 'production') return { ok: true, reasons };

  const need = (name: string, why: string): void => {
    const v = env[name];
    if (!v || !v.trim()) reasons.push(`${name} is required in production — ${why}`);
  };

  need('JWT_SECRET', 'signs every access token');
  need('COPY_SIGNING_KEY', 'signs every issued personal copy (or set COPY_SIGNING_KEY_FILE)');
  if (!env.COPY_SIGNING_KEY && env.COPY_SIGNING_KEY_FILE) {
    // COPY_SIGNING_KEY_FILE substitutes for COPY_SIGNING_KEY — retract the
    // reason we may have pushed above.
    const idx = reasons.findIndex((r) => r.startsWith('COPY_SIGNING_KEY '));
    if (idx >= 0) reasons.splice(idx, 1);
  }
  need('DB_PASSWORD', 'authenticates the app to PostgreSQL');
  need('REDIS_URL', 'shares rate-limit counters across nodes (§docs/RATE-LIMITS.md)');

  const cors = env.CORS_ORIGIN?.trim();
  if (!cors || cors === '*') {
    reasons.push('CORS_ORIGIN=* is not allowed in production — set an explicit origin');
  }

  // Bare-minimum length checks on the two most critical secrets.
  const jwt = env.JWT_SECRET;
  if (jwt && jwt.length < 32) {
    reasons.push('JWT_SECRET is shorter than 32 characters');
  }
  if (env.COPY_SIGNING_KEY) {
    const hex = env.COPY_SIGNING_KEY;
    if (!/^[0-9a-f]+$/i.test(hex) || hex.length < 64) {
      reasons.push('COPY_SIGNING_KEY must be hex, ≥ 64 characters (32 bytes)');
    }
  }

  if (env.DB_SYNCHRONIZE === 'true') {
    reasons.push('DB_SYNCHRONIZE=true is not allowed in production');
  }

  return { ok: reasons.length === 0, reasons };
}

export function enforceProductionGuards(env: NodeJS.ProcessEnv = process.env): void {
  const result = evaluateProductionGuards(env);
  if (result.ok) return;
  const heading = 'Refusing to start: production configuration is unsafe';
  const details = result.reasons.map((r) => `  • ${r}`).join('\n');
  // Use process.stderr so we never depend on a Nest logger that hasn't
  // booted yet.
  process.stderr.write(`\n${heading}\n${details}\n\n`);
  process.exit(2);
}
