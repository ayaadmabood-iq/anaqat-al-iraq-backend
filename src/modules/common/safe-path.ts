import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

/**
 * Resolve `relative` under `root` and refuse anything that escapes it.
 * Also refuses absolute paths, backslashes, NUL bytes, and empty strings.
 *
 * Use this at every file-system boundary: master PDF loads, sample PDF
 * downloads, per-copy writes.
 */
export function safeJoin(root: string, relative: string): string {
  if (typeof relative !== 'string' || relative.length === 0) {
    throw new BadRequestException('empty path');
  }
  if (relative.includes('\0')) {
    throw new BadRequestException('null byte in path');
  }
  if (relative.includes('\\')) {
    throw new BadRequestException('backslashes not allowed');
  }
  if (path.isAbsolute(relative)) {
    throw new BadRequestException('absolute paths not allowed');
  }
  const rootAbs = path.resolve(root);
  const targetAbs = path.resolve(rootAbs, relative);
  const rel = path.relative(rootAbs, targetAbs);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new BadRequestException('path escapes storage root');
  }
  return targetAbs;
}

/**
 * Sanitize a filename for use in a `Content-Disposition` header. Strips path
 * separators, control characters and quote marks — never trust user data in
 * a filename that ends up in a header.
 */
export function safeFilename(name: string, fallback = 'download.pdf'): string {
  if (!name) return fallback;
  const stripped = name
    .replace(/[\x00-\x1f\x7f]/g, '')
    .replace(/[\\/"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped.length ? stripped.slice(0, 128) : fallback;
}
