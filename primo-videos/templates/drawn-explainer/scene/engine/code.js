// explicação desenhada · cores de sintaxe do bloco de código.
// Portado do explainroo (https://github.com/vincentsch/explainroo, engine/code.js, commit 5347905),
// MIT, © 2026 Vincent Schmalbach: licença em templates/drawn-explainer/LICENSE-explainroo.txt.
// Mudanças para a skill: nenhuma.
//
// A small syntax highlighter for code on screen. It colors comments, strings,
// numbers, keywords and function calls for the common languages; anything it
// does not know stays plain.

const KEYWORDS = {
  js: 'async await break case catch class const continue default delete do else export extends false finally for from function if import in instanceof let new null of return static super switch this throw true try typeof undefined var void while yield',
  py: 'and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield self',
  go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false err',
  rust: 'as async await break const continue crate else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while',
  php: 'abstract and array as break callable case catch class clone const continue declare default do echo else elseif empty extends final finally fn for foreach function global if implements include instanceof interface isset list match namespace new null or print private protected public readonly require return static switch throw trait true false try use var while yield',
  sh: 'if then else elif fi for while do done case esac in function return export local echo exit sudo cd npm npx node git curl',
  sql: 'select from where join left right inner outer on group by order having limit insert into values update set delete create table index as and or not null is in like count sum avg distinct',
  json: 'true false null',
};
KEYWORDS.ts = KEYWORDS.js + ' interface type enum implements private public readonly as';
KEYWORDS.jsx = KEYWORDS.js;
KEYWORDS.tsx = KEYWORDS.ts;
KEYWORDS.bash = KEYWORDS.sh;
KEYWORDS.shell = KEYWORDS.sh;
KEYWORDS.python = KEYWORDS.py;
KEYWORDS.javascript = KEYWORDS.js;
KEYWORDS.typescript = KEYWORDS.ts;

const sets = {};
function keywordSet(lang) {
  const k = String(lang || 'js').toLowerCase();
  if (!sets[k]) sets[k] = new Set((KEYWORDS[k] || KEYWORDS.js).split(' ').map((w) => (k === 'sql' ? w.toLowerCase() : w)));
  return sets[k];
}

function commentStart(lang) {
  const k = String(lang || 'js').toLowerCase();
  if (['py', 'python', 'sh', 'bash', 'shell'].includes(k)) return ['#'];
  if (k === 'sql') return ['--'];
  if (k === 'php') return ['//', '#'];
  if (k === 'json') return [];
  return ['//'];
}

// Markdown, including the original engine's script syntax: headings, [#marks],
// [pause] and {shown|spoken}.
function highlightMarkdown(line) {
  if (/^\s*#/.test(line)) return [{ text: line, type: 'keyword' }];
  if (/^\s*>/.test(line)) return [{ text: line, type: 'comment' }];
  const out = [];
  const re = /(\[#[^\]]*\]|\[pause[^\]]*\])|(\{[^}]*\})|(`[^`]*`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), type: 'plain' });
    out.push({ text: m[0], type: m[1] ? 'string' : m[2] ? 'fn' : 'number' });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last), type: 'plain' });
  return out;
}

// One line -> [{ text, type }] with type in comment|string|number|keyword|fn|punct|plain.
export function highlightLine(line, lang) {
  if (['md', 'markdown'].includes(String(lang).toLowerCase())) return highlightMarkdown(line);
  const out = [];
  const kw = keywordSet(lang);
  const isSql = String(lang).toLowerCase() === 'sql';
  const cstarts = commentStart(lang);
  let i = 0;
  const push = (text, type) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ text, type });
  };
  while (i < line.length) {
    const rest = line.slice(i);
    const cs = cstarts.find((c) => rest.startsWith(c));
    if (cs || rest.startsWith('/*')) {
      push(rest, 'comment');
      break;
    }
    const ch = line[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1;
      while (j < line.length && line[j] !== ch) j += line[j] === '\\' ? 2 : 1;
      push(line.slice(i, j + 1), 'string');
      i = j + 1;
      continue;
    }
    const num = /^(0x[0-9a-f]+|\d+(\.\d+)?)/i.exec(rest);
    if (num && !/[A-Za-z_$]/.test(line[i - 1] || '')) {
      push(num[0], 'number');
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_$][\w$]*/.exec(rest);
    if (id) {
      const word = id[0];
      const next = line.slice(i + word.length).trimStart()[0];
      if (kw.has(isSql ? word.toLowerCase() : word)) push(word, 'keyword');
      else if (next === '(') push(word, 'fn');
      else push(word, 'plain');
      i += word.length;
      continue;
    }
    if (/[{}()[\];,.:=<>+\-*/%!&|?]/.test(ch)) {
      push(ch, 'punct');
      i++;
      continue;
    }
    push(ch, 'plain');
    i++;
  }
  return out;
}
