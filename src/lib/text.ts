// Tiny Python syntax highlighter + inline markdown for stems/explanations (no dependencies, works offline).
const KW = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'.split(
    ' ',
  ),
);
const BUILTIN = new Set(
  'print len range type int float str list dict set tuple bool sorted reversed enumerate zip map filter sum min max abs open isinstance issubclass super object id input round any all iter next repr hash ord chr divmod pow format getattr setattr hasattr vars dir help Exception ValueError TypeError KeyError IndexError NameError AttributeError ZeroDivisionError StopIteration RecursionError AssertionError IOError OSError FileNotFoundError SyntaxError IndentationError ImportError ModuleNotFoundError self np pd plt'.split(
    ' ',
  ),
);

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const TOKEN =
  /(#[^\n]*)|([rbfuRBFU]{0,2}"""[\s\S]*?"""|[rbfuRBFU]{0,2}'''[\s\S]*?'''|[rbfuRBFU]{0,2}"(?:\\.|[^"\\\n])*"?|[rbfuRBFU]{0,2}'(?:\\.|[^'\\\n])*'?)|(\b\d[\d_]*\.?\d*(?:e[+-]?\d+)?j?\b)|(@[A-Za-z_][\w.]*)|([A-Za-z_]\w*)|(>>>|\.\.\.)/g;

export function highlightPython(code: string): string {
  let out = '';
  let last = 0;
  let prevWord = '';
  for (const m of code.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    out += escapeHtml(code.slice(last, i));
    const [tok, comment, str, num, deco, word, prompt] = m;
    if (comment) out += `<span class="tk-c">${escapeHtml(tok)}</span>`;
    else if (str) out += `<span class="tk-s">${escapeHtml(tok)}</span>`;
    else if (num) out += `<span class="tk-n">${escapeHtml(tok)}</span>`;
    else if (deco) out += `<span class="tk-d">${escapeHtml(tok)}</span>`;
    else if (prompt) out += `<span class="tk-p">${escapeHtml(tok)}</span>`;
    else if (word) {
      if (prevWord === 'def' || prevWord === 'class') out += `<span class="tk-f">${escapeHtml(tok)}</span>`;
      else if (KW.has(word)) out += `<span class="tk-k">${escapeHtml(tok)}</span>`;
      else if (BUILTIN.has(word)) out += `<span class="tk-b">${escapeHtml(tok)}</span>`;
      else out += escapeHtml(tok);
      prevWord = word;
    } else out += escapeHtml(tok);
    if (!word) prevWord = prevWord && /^\s*$/.test(tok) ? prevWord : '';
    last = i + tok.length;
  }
  return out + escapeHtml(code.slice(last));
}

/** Only `code` spans (safe for option texts that contain *args / **kwargs). */
export function codeSpans(s: string): string {
  return s
    .split(/(`[^`\n]+`)/g)
    .map((p) => (p.length > 2 && p.startsWith('`') && p.endsWith('`') ? `<code>${escapeHtml(p.slice(1, -1))}</code>` : escapeHtml(p)))
    .join('');
}

/** Inline markdown: `code`, **bold**, *italic*, line breaks / paragraphs. Input is escaped first. */
export function inlineMd(s: string): string {
  const parts = s.split(/(`[^`]+`)/g);
  const html = parts
    .map((p) => {
      if (p.startsWith('`') && p.endsWith('`') && p.length > 1) return `<code>${escapeHtml(p.slice(1, -1))}</code>`;
      return escapeHtml(p)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    })
    .join('');
  return html
    .split(/\n{2,}/)
    .map((para) => para.replace(/\n/g, '<br>'))
    .join('<br><br>');
}

export function slidesLabel(pages: number[]): string {
  if (!pages.length) return '';
  const s = [...new Set(pages)].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = s[0];
  let prev = s[0];
  for (const p of s.slice(1).concat([Infinity])) {
    if (p === prev + 1) {
      prev = p;
      continue;
    }
    ranges.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = p;
    prev = p;
  }
  return (s.length > 1 ? 'pp. ' : 'p. ') + ranges.join(', ');
}
