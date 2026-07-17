#!/usr/bin/env ts-node
/**
 * Audit gate — CI-friendly wrapper around `npm audit --json`.
 *
 *   • Every Critical advisory fails the build unconditionally.
 *   • Every High advisory fails unless its GHSA is present in
 *     .audit-allowlist.json with a non-expired expiresAt.
 *   • Moderate/Low advisories are reported but do not fail.
 *
 * Prints a compact table to stdout and exits non-zero on any block.
 *
 * Usage:
 *   node dist/scripts/audit-gate.js   (in CI, after `npm run build`)
 *   npm run audit-gate                (locally — invokes ts-node)
 */
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface Advisory {
  ghsa: string;
  package: string;
  severity: 'critical' | 'high' | 'moderate' | 'low' | 'info';
}
interface AllowEntry {
  ghsa: string;
  package: string;
  severity: string;
  reason: string;
  /** Legacy — kept for backwards compatibility. */
  owner?: string;
  /** Developer/security lead who monitors upstream for a patch. */
  technicalOwner?: string;
  /** Business owner who approved carrying the residual risk. */
  riskAcceptedBy?: string;
  expiresAt: string;
}
interface AllowDoc {
  allow?: AllowEntry[];
  policy?: { maxExpiryDays?: number; lastReviewedAt?: string };
}

function runAudit(): { advisories: Advisory[]; raw: unknown } {
  const res = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  // npm audit returns non-zero when vulns exist — we still need the JSON.
  if (!res.stdout) {
    throw new Error(`npm audit failed to produce output: ${res.stderr}`);
  }
  const parsed = JSON.parse(res.stdout);
  const list: Advisory[] = [];
  const vuls = parsed.vulnerabilities || {};
  for (const [pkg, entry] of Object.entries(vuls) as [string, { severity: string; via?: unknown[] }][]) {
    const severity = entry.severity as Advisory['severity'];
    for (const via of entry.via || []) {
      if (typeof via === 'object' && via && 'source' in via) {
        const v = via as { source?: string | number; url?: string; title?: string };
        // Extract GHSA from URL if present.
        const url = String(v.url || '');
        const m = url.match(/GHSA-[0-9a-z-]+/i);
        const ghsa = m ? m[0] : String(v.source ?? 'unknown');
        list.push({ ghsa, package: pkg, severity });
      }
    }
    if ((entry.via || []).length === 0) list.push({ ghsa: 'unknown', package: pkg, severity });
  }
  return { advisories: list, raw: parsed };
}

function loadAllowlist(): AllowDoc {
  const p = path.join(process.cwd(), '.audit-allowlist.json');
  if (!fs.existsSync(p)) return { allow: [] };
  return JSON.parse(fs.readFileSync(p, 'utf8')) as AllowDoc;
}

function validateAllowlistShape(doc: AllowDoc): string[] {
  const errs: string[] = [];
  const maxDays = doc.policy?.maxExpiryDays ?? 90;
  const now = new Date();
  for (const e of doc.allow ?? []) {
    if (!e.ghsa || !e.package || !e.severity || !e.reason || !e.expiresAt) {
      errs.push(`entry missing required fields: ${JSON.stringify(e)}`);
      continue;
    }
    if (!e.technicalOwner && !e.owner) {
      errs.push(`entry ${e.package}/${e.ghsa} missing technicalOwner`);
    }
    if (!e.riskAcceptedBy) {
      errs.push(`entry ${e.package}/${e.ghsa} missing riskAcceptedBy`);
    }
    const exp = new Date(e.expiresAt);
    if (isNaN(exp.getTime())) {
      errs.push(`entry ${e.package}/${e.ghsa} has invalid expiresAt`);
      continue;
    }
    const daysAhead = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysAhead > maxDays + 1) {
      errs.push(
        `entry ${e.package}/${e.ghsa} expiresAt=${e.expiresAt} is more than ${maxDays} days ahead — policy violation`,
      );
    }
  }
  return errs;
}

function main() {
  const { advisories } = runAudit();
  const allowDoc = loadAllowlist();
  const allow = allowDoc.allow ?? [];
  const shapeErrs = validateAllowlistShape(allowDoc);
  if (shapeErrs.length) {
    console.log('\nAllowlist policy violations:');
    for (const e of shapeErrs) console.log(`  ✗ ${e}`);
    process.exit(1);
  }
  const now = new Date();

  // Deduplicate (ghsa, package).
  const seen = new Set<string>();
  const uniq = advisories.filter((a) => {
    const k = `${a.package}|${a.ghsa}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const blocking: Array<{ a: Advisory; why: string }> = [];
  const informational: Advisory[] = [];
  for (const a of uniq) {
    if (a.severity === 'critical') {
      blocking.push({ a, why: 'critical — never allowed' });
      continue;
    }
    if (a.severity === 'high') {
      const hit = allow.find((e) => e.ghsa === a.ghsa && e.package === a.package);
      if (!hit) {
        blocking.push({ a, why: 'high not in allowlist' });
        continue;
      }
      if (new Date(hit.expiresAt) < now) {
        blocking.push({ a, why: `high allowlist entry expired ${hit.expiresAt}` });
        continue;
      }
      informational.push(a);
      continue;
    }
    informational.push(a);
  }

  console.log(`\nAudit gate — ${uniq.length} unique advisory rows`);
  console.log(`  blocking: ${blocking.length}   informational: ${informational.length}`);
  if (blocking.length) {
    console.log('\nBlocking:');
    for (const { a, why } of blocking) {
      console.log(`  ✗ [${a.severity}] ${a.package} ${a.ghsa} — ${why}`);
    }
  }
  if (informational.length && !process.env.AUDIT_QUIET) {
    console.log('\nAllowed / informational:');
    for (const a of informational) {
      console.log(`  · [${a.severity}] ${a.package} ${a.ghsa}`);
    }
  }
  process.exit(blocking.length ? 1 : 0);
}

main();
