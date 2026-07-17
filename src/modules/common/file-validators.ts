import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';

/**
 * Content-type / magic-byte pairs we accept as a transfer proof.
 *
 * MIME alone is trusted only to gate the upload BEFORE we've read any bytes;
 * once written to disk we sniff the first bytes as a defence in depth. If the
 * sniff mismatches, we delete the file and reject the request.
 */
const ALLOWED_TRANSFER_TYPES: Array<{
  mime: RegExp;
  magic: Array<Buffer>;
  ext: string[];
}> = [
  {
    mime: /^image\/png$/,
    magic: [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ext: ['.png'],
  },
  {
    mime: /^image\/jpe?g$/,
    magic: [Buffer.from([0xff, 0xd8, 0xff])],
    ext: ['.jpg', '.jpeg'],
  },
  {
    mime: /^image\/webp$/,
    magic: [Buffer.from('RIFF', 'ascii')], // followed by size + "WEBP"
    ext: ['.webp'],
  },
  {
    mime: /^application\/pdf$/,
    magic: [Buffer.from('%PDF-', 'ascii')],
    ext: ['.pdf'],
  },
];

export const TRANSFER_MAX_BYTES = 8 * 1024 * 1024;

export function isTransferMimeAllowed(mime: string): boolean {
  return ALLOWED_TRANSFER_TYPES.some((t) => t.mime.test(mime));
}

export function assertTransferExtension(originalName: string): void {
  const lower = (originalName || '').toLowerCase();
  const ok = ALLOWED_TRANSFER_TYPES.some((t) =>
    t.ext.some((e) => lower.endsWith(e)),
  );
  if (!ok) throw new BadRequestException('امتداد الملف غير مسموح');
}

/**
 * Reads the first bytes of the file and verifies that the magic matches one
 * of the allowed types. Deletes the file if the magic does not match.
 */
export async function sniffAndValidate(
  absolutePath: string,
  declaredMime: string,
): Promise<void> {
  const fh = await fs.promises.open(absolutePath, 'r');
  try {
    const buf = Buffer.alloc(16);
    await fh.read(buf, 0, 16, 0);
    const declared = ALLOWED_TRANSFER_TYPES.find((t) => t.mime.test(declaredMime));
    const magicMatches = ALLOWED_TRANSFER_TYPES.some((t) =>
      t.magic.some((m) => buf.slice(0, m.length).equals(m)),
    );
    if (!declared || !magicMatches) {
      await fh.close();
      await fs.promises.unlink(absolutePath).catch(() => {});
      throw new BadRequestException('محتوى الملف لا يطابق نوعه المعلَن');
    }
  } finally {
    await fh.close().catch(() => {});
  }
}
