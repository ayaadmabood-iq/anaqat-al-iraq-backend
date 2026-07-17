import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Loads the bundled Amiri font once per process and embeds it into any pdf-lib
 * document that asks for it. Amiri covers the Arabic Unicode block plus
 * Presentation Forms A/B, which is what `arabic-reshaper` produces.
 *
 * Falling back to StandardFonts.Helvetica is only for strings that have no
 * Arabic characters — Helvetica is WinAnsi-only and would raise "cannot
 * encode …" for anything outside U+00A0-U+00FF.
 */

let cachedFontBytes: Uint8Array | null = null;

function loadFontBytes(): Uint8Array {
  if (cachedFontBytes) return cachedFontBytes;
  const p =
    process.env.ARABIC_FONT_PATH ||
    path.join(__dirname, '..', '..', 'assets', 'fonts', 'Amiri-Regular.ttf');
  cachedFontBytes = fs.readFileSync(p);
  return cachedFontBytes;
}

export async function embedFonts(
  pdf: PDFDocument,
): Promise<{ latin: PDFFont; arabic: PDFFont }> {
  pdf.registerFontkit(fontkit);
  const latin = await pdf.embedFont(StandardFonts.Helvetica);
  const arabic = await pdf.embedFont(loadFontBytes(), { subset: true });
  return { latin, arabic };
}
