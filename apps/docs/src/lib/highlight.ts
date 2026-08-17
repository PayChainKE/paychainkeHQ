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

// These paint inside code panels, which stay dark in both site themes (see
// tailwind.config.ts's "code" palette) — fixed colors, not the theme-able
// ink-*/brand-* tokens the rest of the page uses.
const cls = {
  comment: "text-code-faint",
  string: "text-code-accent",
  key: "text-sky-300",
  number: "text-amber-300",
  keyword: "text-fuchsia-300",
  bool: "text-amber-300",
  flag: "text-code-muted",
  cmd: "text-code-text font-semibold",
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

const PHP_KEYWORDS = "function|return|if|else|elseif|foreach|as|new|echo|use|require|require_once|namespace|class|public|private|static|true|false|null|throw|try|catch";

function highlightPhp(code: string): string {
  const esc = escapeHtml(code);
  // $variable gets its own capture (PHP's defining visual tic) ahead of the
  // generic keyword/string/comment pass, same one-pass-over-plain-text
  // reasoning as every other highlighter here.
  const re = new RegExp(
    `(//.*$|#(?!\\[).*$)|('[^']*'|"[^"]*")|(\\$[A-Za-z_]\\w*)|\\b(${PHP_KEYWORDS})\\b|\\b(\\d+)\\b`,
    "gm"
  );
  return esc.replace(re, (match, comment, str, variable, kw, num) => {
    if (comment !== undefined) return wrap(comment, cls.comment);
    if (str !== undefined) return wrap(str, cls.string);
    if (variable !== undefined) return wrap(variable, cls.key);
    if (kw !== undefined) return wrap(kw, cls.keyword);
    if (num !== undefined) return wrap(num, cls.number);
    return match;
  });
}

const RUBY_KEYWORDS = "def|end|do|require|class|module|return|if|elsif|else|unless|while|puts|new|raise|begin|rescue|true|false|nil|and|or|not|in";

function highlightRuby(code: string): string {
  const esc = escapeHtml(code);
  const re = new RegExp(
    `(#.*$)|('[^']*'|"[^"]*")|(:[A-Za-z_]\\w*)|\\b(${RUBY_KEYWORDS})\\b|\\b(\\d+)\\b`,
    "gm"
  );
  return esc.replace(re, (match, comment, str, symbol, kw, num) => {
    if (comment !== undefined) return wrap(comment, cls.comment);
    if (str !== undefined) return wrap(str, cls.string);
    if (symbol !== undefined) return wrap(symbol, cls.key);
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
    case "php":
      return highlightPhp(code);
    case "ruby":
      return highlightRuby(code);
    default:
      return escapeHtml(code);
  }
}
