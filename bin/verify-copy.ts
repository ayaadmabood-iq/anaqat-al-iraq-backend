#!/usr/bin/env ts-node
/**
 * Offline verifier for a personal-copy fingerprint.
 *
 * Given a payload JSON file and a signature, it re-computes the HMAC using the
 * signing key on this host and reports match/mismatch. Optionally also hashes
 * a PDF file on disk and checks the recorded sha256.
 *
 * Usage:
 *   COPY_SIGNING_KEY_FILE=/root/keys/copy.key \
 *     node dist/bin/verify-copy.js --payload payload.json --sig sig.json [--file copy.pdf]
 *
 * The payload JSON is the object printed on the certificate page of every
 * personal copy (or the row in `issued_copy_generations.signature` +
 * `issued_copies.hiddenWatermarkPayload` from the database).
 */
import * as fs from 'fs';
import { SigningService, SigningPayload, Signature } from '../src/modules/fingerprint/signing.service';
import { createHash } from 'crypto';

function parseArgs(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.payload || !args.sig) {
    console.error('usage: verify-copy --payload <json> --sig <json> [--file <pdf>]');
    process.exit(2);
  }
  const payloadJson = JSON.parse(fs.readFileSync(args.payload, 'utf8'));
  const sigJson = JSON.parse(fs.readFileSync(args.sig, 'utf8')) as Signature;

  // Accept either a bare payload or the {payload,signature} pair.
  const payload: SigningPayload =
    'copyUuid' in payloadJson ? payloadJson : payloadJson.payload ?? payloadJson;

  const svc = new SigningService();
  (svc as unknown as { load: () => void }).load();
  const ok = svc.verify(payload, sigJson);

  const report: Record<string, unknown> = {
    signature: ok ? 'VALID' : 'INVALID',
    keyId: sigJson.keyId,
    algo: sigJson.algo,
    signedAt: sigJson.signedAt,
    payload,
  };

  if (args.file) {
    const buf = fs.readFileSync(args.file);
    const hash = createHash('sha256').update(buf).digest('hex');
    report.file = args.file;
    report.fileSha256 = hash;
    report.fileHashMatches = hash === payload.fileSha256;
  }

  console.log(JSON.stringify(report, null, 2));
  const exit = ok && (!args.file || report.fileHashMatches) ? 0 : 1;
  process.exit(exit);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
