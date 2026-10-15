// Where the key travels, shared by scripts/probe.mjs and the manifest
// checks. A credential is {header: [name, value]} or {query: [name, value]}.
// The manifest's `auth` picks one: "bearer" and {"header": name, "prefix"?:
// text} send a header; {"query": name} puts name=<key> in the query string,
// replacing every parameter of that name the request already carried, so
// the caller can never choose the value the API sees. A query credential
// also appears in the request URL, so anything that prints or records a URL
// must pass it through redactText first.

// A query parameter name that survives the URL unencoded and cannot smuggle
// a second parameter or an escape: no separators, whitespace or percent.
export const PARAM_NAME = /^[^\s=&%]+$/;

export const AUTH_FORMS = 'auth must be "bearer", {"header": name, "prefix"?: text} or {"query": name}';

// Null when `auth` is one of the three forms, otherwise why not. The schema
// says the same; this gives the checks a message in words.
export function authProblem(auth) {
  if (auth === "bearer") return null;
  if (auth && typeof auth === "object" && !Array.isArray(auth)) {
    const keys = Object.keys(auth).sort().join(",");
    const text = (v) => typeof v === "string" && v.length > 0;
    if (keys === "header" && text(auth.header)) return null;
    if (keys === "header,prefix" && text(auth.header) && text(auth.prefix)) return null;
    if (keys === "query") {
      if (typeof auth.query === "string" && PARAM_NAME.test(auth.query)) return null;
      return `auth.query must be a parameter name without whitespace, =, & or %, got ${JSON.stringify(auth.query)}`;
    }
  }
  return `${AUTH_FORMS}, got ${JSON.stringify(auth)}`;
}

export function credential(auth, key) {
  const why = authProblem(auth);
  if (why) throw new TypeError(why);
  if (auth === "bearer") return { header: ["authorization", `Bearer ${key}`] };
  if (typeof auth.header === "string") return { header: [auth.header, auth.prefix ? `${auth.prefix} ${key}` : key] };
  return { query: [auth.query, key] };
}

// x-www-form-urlencoded: letters, digits, - . _ ~ stay, a space becomes +,
// every other byte is %XX.
export function encodeWwwForm(text) {
  let out = "";
  for (const byte of Buffer.from(String(text), "utf8")) {
    const c = String.fromCharCode(byte);
    if (/[A-Za-z0-9._~-]/.test(c)) out += c;
    else if (c === " ") out += "+";
    else out += "%" + byte.toString(16).toUpperCase().padStart(2, "0");
  }
  return out;
}

function decodeWwwForm(text) {
  try {
    return decodeURIComponent(text.replace(/\+/g, " "));
  } catch {
    return text;
  }
}

// `query` (no leading ?) with every parameter named `name` removed and
// name=value appended, URL-encoded. Other pairs keep the caller's encoding;
// only their keys are decoded for the comparison, so %74oken is token too.
export function queryString(query, name, value) {
  const kept = query.split("&").filter((pair) => pair !== "" && decodeWwwForm(pair.split("=", 1)[0]) !== name);
  return [...kept, `${encodeWwwForm(name)}=${encodeWwwForm(value)}`].join("&");
}

// Places a credential on a request: a header credential goes first in
// `headers`, a query credential replaces its parameter in `url` (a full URL
// or a path, with or without a query string).
export function apply(url, headers, cred) {
  if (cred.header) return { url, headers: [cred.header, ...headers] };
  const [name, value] = cred.query;
  const at = url.indexOf("?");
  const [base, query] = at === -1 ? [url, ""] : [url.slice(0, at), url.slice(at + 1)];
  return { url: `${base}?${queryString(query, name, value)}`, headers };
}

// The key as typed and as it appears URL-encoded in a query string.
export function keyForms(key) {
  return [...new Set([key, encodeWwwForm(key), encodeURIComponent(key)])].filter((form) => form !== "");
}

export function holdsKey(text, key) {
  return keyForms(key).some((form) => text.includes(form));
}

// `text` with every form of the key replaced, for messages and request lines
// that may quote a URL.
export function redactText(text, key) {
  let out = String(text);
  for (const form of keyForms(key)) out = out.split(form).join("[redacted]");
  return out;
}
