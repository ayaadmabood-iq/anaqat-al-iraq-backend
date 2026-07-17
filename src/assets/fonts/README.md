# Bundled fonts

## Amiri-Regular.ttf

Amiri, an open-source Arabic typeface designed by Khaled Hosny.

- Upstream: https://github.com/aliftype/amiri
- Version: 1.001
- License: SIL Open Font License 1.1 — full text in [`OFL.txt`](./OFL.txt).

The font is embedded into every issued personal-copy PDF and every forensic
report PDF. Subsetting is enabled (`{ subset: true }`) so only the glyphs
actually used are shipped inside each output file — this keeps a 300-page
PDF under 700 KB.

Compliance with the OFL:

- The full license text ships with this repository (see `OFL.txt`).
- The name "Amiri" is not used in any modified variant we ship.
- The font is not sold on its own.
- Every generated PDF that embeds Amiri complies with the OFL clauses because
  embedding is explicitly permitted.
