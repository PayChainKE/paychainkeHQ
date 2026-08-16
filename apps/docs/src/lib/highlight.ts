// Minimal, dependency-free syntax highlighting for the handful of languages
// used in these docs (bash/curl, JSON, JavaScript). A real highlighter
// (Prism/Shiki) is overkill for a few dozen fixed code samples we control
// ourselves — this just needs to look right for exactly those samples, not
// parse arbitrary source.
//
// Each language does exactly ONE regex pass over the escaped source and
// decides per-match what to wrap, via a single alternation with a callback
// that checks which capture group fired. That's deliberate: replacing with
// several *sequential* regexes (each one scanning the previous pass's HTML
// output) is a trap — a later pass can match digits inside an earlier pass's
// own `class="text-amber-300"` attribute and corrupt it. One pass over
// plain text has nothing to corrupt.
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const cls = {
  comment: "text-ink-faint",
  string: "text-brand-bright",
  key: "text-sky-300",
  number: "text-amber-300",
  keyword: "text-fuchsia-300",
  bool: "text-amber-300",
  flag: "text-ink-muted",
  cmd: "text-ink font-semibold",
};

function wrap(text: string, className: string) {
  return `<span class="${className}">${text}</span>`;
}

function highlightBash(code: string): string {
  return code
    .split("\n")
    .map((line) => {
      if (/^\s*#/.test(line)) return wrap(escapeHtml(line), cls.comment);
      const esc = escapeHtml(line);
      const re = /("[^"]*")|(^)(curl|npm|node|python|export)\b|(^|\s)(--?[a-zA-Z][\w-]*)/g;
      return esc.replace(re, (match, str, _cmdPre, cmd, flagPre, flag) => {
        if (str !== undefined) return wrap(str, cls.string);
        if (cmd !== undefined) return wrap(cmd, cls.cmd);
        if (flag !== undefined) return `${flagPre}${wrap(flag, cls.flag)}`;
        return match;
      });
    })
    .join("\n");
}

function highlightJson(code: string): string {
  const esc = escapeHtml(code);
  const re = /("[^"]*")(\s*:)|("[^"]*")|(-?\b\d+(?:\.\d+)?\b)|\b(true|false|null)\b/g;
  return esc.replace(re, (match, key, colon, str, num, bool) => {
    if (key !== undefined) return `${wrap(key, cls.key)}${colon}`;
    if (str !== undefined) return wrap(str, cls.string);
    if (num !== undefined) return wrap(num, cls.number);
    if (bool !== undefined) return wrap(bool, cls.bool);
    return match;
  });
}

const JS_KEYWORDS = "const|let|var|function|async|await|return|if|else|require|import|from|export|default|new|throw|try|catch";
const PY_KEYWORDS = "def|import|from|return|if|elif|else|for|while|with|as|try|except|raise|True|False|None|and|or|not|in|class|lambda";

function highlightJs(code: string): string {
  const esc = escapeHtml(code);
  const re = new RegExp(
    `(//.*$)|(\`[^\`]*\`|'[^']*'|"[^"]*")|\\b(${JS_KEYWORDS})\\b|\\b(\\d+)\\b`,
    "gm"
  );
  return esc.replace(re, (match, comment, str, kw, num) => {
    if (comment !== undefined) return wrap(comment, cls.comment);
    if (str !== undefined) return wrap(str, cls.string);
    if (kw !== undefined) return wrap(kw, cls.keyword);
    if (num !== undefined) return wrap(num, cls.number);
    return match;
  });
}

function highlightPython(code: string): string {
  const esc = escapeHtml(code);
  const re = new RegExp(
    `(#.*$)|('[^']*'|"[^"]*")|\\b(${PY_KEYWORDS})\\b|\\b(\\d+)\\b`,
    "gm"
  );
  return esc.replace(re, (match, comment, str, kw, num) => {
    if (comment !== undefined) return wrap(comment, cls.comment);
    if (str !== undefined) return wrap(str, cls.string);
    if (kw !== undefined) return wrap(kw, cls.keyword);
    if (num !== undefined) return wrap(num, cls.number);
    return match;
  });
}

export function highlight(code: string, lang: string): string {
  switch (lang) {
    case "bash":
    case "shell":
      return highlightBash(code);
    case "json":
      return highlightJson(code);
    case "js":
    case "javascript":
      return highlightJs(code);
    case "python":
      return highlightPython(code);
    default:
      return escapeHtml(code);
  }
}
