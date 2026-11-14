import type { ReactNode } from 'react';

const KW = new Set(['void', 'int', 'long', 'float', 'const', 'for', 'if', 'else', 'while', 'return', 'bool', 'true', 'false', 'from', 'import', 'def', 'class']);
const FN = /^(pinMode|digitalWrite|digitalRead|analogWrite|analogRead|delay|delayMicroseconds|millis|Serial|println|print|begin|map|tone|noTone|pulseIn|attach|write|setup|loop)$/;
const CONST = /^(HIGH|LOW|OUTPUT|INPUT|INPUT_PULLUP|LED_BUILTIN|A\d)$/;

/** 很小的 C++ 語法上色：註解、字串、數字、關鍵字、函式 */
export function highlight(line: string, keyBase = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const ci = line.indexOf('//');
  const code = ci >= 0 ? line.slice(0, ci) : line;
  const comment = ci >= 0 ? line.slice(ci) : '';
  const re = /("[^"]*"|\b\d+(?:\.\d+)?\b|[A-Za-z_]\w*|#include|<[\w.]+>)/g;
  let last = 0;
  let k = keyBase;
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const t = m[0];
    let cls = '';
    if (t.startsWith('"')) cls = 'tok-s';
    else if (/^\d/.test(t)) cls = 'tok-n';
    else if (KW.has(t) || t === '#include') cls = 'tok-k';
    else if (FN.test(t)) cls = 'tok-f';
    else if (CONST.test(t)) cls = 'tok-n';
    else if (t.startsWith('<')) cls = 'tok-s';
    out.push(cls ? <span key={k++} className={cls}>{t}</span> : t);
    last = m.index + t.length;
  }
  if (last < code.length) out.push(code.slice(last));
  if (comment) out.push(<span key={k++} className="tok-c">{comment}</span>);
  return out;
}
