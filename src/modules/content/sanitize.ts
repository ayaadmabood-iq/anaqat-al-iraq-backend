/**
 * Minimal CMS-content sanitizer.
 *
 * Purpose: strip anything that could execute JavaScript in the reader's
 * browser when a CMS body field is rendered as HTML. We are deliberately
 * dependency-free — every third-party HTML sanitizer we tried either pulled
 * an ESM-only subgraph incompatible with the CommonJS Nest build or created
 * more attack surface than the tiny bit of HTML we actually accept.
 *
 * The allowlist is small on purpose. If the owner needs richer markup later,
 * add tags to ALLOWED_TAGS explicitly and re-review this file.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'blockquote',
  'a', 'code', 'pre', 'hr',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'title']),
};

// Attributes we always inject on <a> so an external link cannot leak the
// referrer or gain window.opener access to the parent page.
const A_HARDENED_ATTRS = ' rel="noopener noreferrer nofollow" target="_blank"';

const SAFE_URL_SCHEMES = /^(https?:|mailto:|\/|#)/i;

function sanitizeHtml(input: string): string {
  if (!input) return '';
  // Strip <script>, <style>, <iframe>, <object>, <embed>, HTML comments.
  let s = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|form|svg)[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|form|svg)[^>]*\/?>/gi, '');

  // Walk every remaining tag. Replace closing tags with a normalized form,
  // and opening tags with an allowlisted subset.
  s = s.replace(/<\s*\/\s*([a-zA-Z0-9]+)\s*>/g, (_, name) => {
    const n = name.toLowerCase();
    return ALLOWED_TAGS.has(n) ? `</${n}>` : '';
  });

  s = s.replace(/<\s*([a-zA-Z0-9]+)((?:\s+[^>]*?)?)\s*(\/?)>/g, (_, name, attrs, selfClose) => {
    const n = String(name).toLowerCase();
    if (!ALLOWED_TAGS.has(n)) return '';
    const allowed = ALLOWED_ATTRS[n] || new Set<string>();
    const attrOut: string[] = [];
    const attrRegex = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    let m: RegExpExecArray | null;
    while ((m = attrRegex.exec(attrs))) {
      const raw = m[1].toLowerCase();
      const val = m[2] ?? m[3] ?? m[4] ?? '';
      if (raw.startsWith('on')) continue; // no event handlers, ever
      if (!allowed.has(raw)) continue;
      if (raw === 'href') {
        if (!SAFE_URL_SCHEMES.test(val.trim())) continue;
      }
      // Escape quotes/newlines defensively.
      const safeVal = val
        .replace(/[\r\n\t]/g, ' ')
        .replace(/"/g, '&quot;');
      attrOut.push(`${raw}="${safeVal}"`);
    }
    const attrString = attrOut.length ? ' ' + attrOut.join(' ') : '';
    const suffix = n === 'a' ? A_HARDENED_ATTRS : '';
    const close = selfClose === '/' || n === 'br' || n === 'hr' ? '/>' : '>';
    return `<${n}${attrString}${suffix}${close === '/>' ? '/>' : '>'}`;
  });

  return s;
}

/**
 * Walk any JSON value and sanitize every string. Numbers/booleans/nulls are
 * returned as-is. Arrays/objects recurse. Strings are HTML-sanitized so a
 * plain-text field also loses any dangerous markup that snuck in.
 */
export function sanitizeCmsValue(value: unknown): unknown {
  if (typeof value === 'string') return sanitizeHtml(value);
  if (Array.isArray(value)) return value.map(sanitizeCmsValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeCmsValue(v);
    }
    return out;
  }
  return value;
}
