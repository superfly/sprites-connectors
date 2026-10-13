// Port of `Sprites.Gateway.Connector.Expect` in sprites-api, plus the manifest
// decoding of `[path, check, ...args]` arrays from
// `Sprites.Gateway.Connector.Manifest`. v1/vectors.json is the parity contract;
// keep this in step with the Elixir rather than improving it on its own.
//
// An expectation is `[path, check, ...args]`. `path` is a dotted key path; a
// `[]` suffix on a segment applies the rest of the path to every element of
// the list found there (an empty list passes vacuously, a non-list counts as
// missing). A missing key or a null value is "missing". Every expectation must
// hold, and only a JSON object can satisfy a list of expectations.
//
// Checks: present, absent, map, list, nonempty_list, boolean, integer, number,
// string, text (non-empty string), eq v, in [v], min n (>=), gt n (>),
// between lo hi (inclusive), prefix s (starts with s and is longer),
// contains s.

export const TYPE_CHECKS = new Set([
  "present",
  "absent",
  "map",
  "list",
  "nonempty_list",
  "boolean",
  "integer",
  "number",
  "string",
  "text",
]);
export const PARAM_CHECKS = new Set(["eq", "in", "min", "gt", "prefix", "contains"]);

const SEGMENT = /^[^.[\]]+(\[\])?$/;

const isMap = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isNumber = (v) => typeof v === "number" && Number.isFinite(v);
// JSON.parse cannot tell `1` from `1.0` the way Elixir's decoder does, so an
// integral float counts as an integer here (see the note in v1/vectors.json).
const isInteger = (v) => Number.isInteger(v);

// Elixir `==` on decoded JSON: structural equality, key order ignored.
export function deepEqual(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  if (isMap(a) && isMap(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
  }
  return false;
}

// Returns the reason an expectation is malformed, or null when it is a valid
// `[path, check, ...args]` array by the manifest loader's and `Expect.validate!/1`'s
// rules.
export function problem(expectation) {
  if (!Array.isArray(expectation) || expectation.length < 2) return "must be [path, check, ...]";
  const [path, check, ...args] = expectation;
  if (typeof path !== "string" || typeof check !== "string") return "must be [path, check, ...]";
  const segments = path.split(".");
  if (!segments.every((s) => SEGMENT.test(s))) return `path must be dotted keys with optional []: ${path}`;
  if (TYPE_CHECKS.has(check)) return args.length === 0 ? null : `${check} takes no argument`;
  if (check === "between") {
    if (args.length !== 2) return "between takes lo and hi";
    const [lo, hi] = args;
    return isNumber(lo) && isNumber(hi) && lo <= hi ? null : "between needs numbers lo <= hi";
  }
  if (!PARAM_CHECKS.has(check)) return `unknown check: ${check}`;
  if (args.length !== 1) return `${check} takes one argument`;
  const [arg] = args;
  switch (check) {
    case "eq":
      return null;
    case "in":
      return Array.isArray(arg) ? null : "in needs a list of values";
    case "min":
    case "gt":
      return isNumber(arg) ? null : `${check} needs a number`;
    case "prefix":
    case "contains":
      return typeof arg === "string" && arg !== "" ? null : `${check} needs a non-empty string`;
    default:
      return `unknown check: ${check}`;
  }
}

// Throws on the first malformed expectation; returns the list otherwise.
export function validate(expectations) {
  if (!Array.isArray(expectations)) throw new TypeError("expectations must be a list of [path, check, ...]");
  for (const expectation of expectations) {
    const why = problem(expectation);
    if (why) throw new TypeError(`${why}: ${JSON.stringify(expectation)}`);
  }
  return expectations;
}

const MISSING = Symbol("missing");

// Resolves a path to one result per leaf it addresses: the value, or MISSING
// for a missing key or null. Each `[]` fans out over the list's elements
// independently; a non-list where `[]` expects one is a single MISSING.
function resolve(segments, value) {
  if (segments.length === 0) return [value];
  if (!isMap(value)) return [MISSING];
  const [segment, ...rest] = segments;
  if (segment.endsWith("[]")) {
    const key = segment.slice(0, -2);
    const list = Object.hasOwn(value, key) ? value[key] : undefined;
    return Array.isArray(list) ? list.flatMap((element) => resolve(rest, element)) : [MISSING];
  }
  const next = Object.hasOwn(value, segment) ? value[segment] : undefined;
  return next === undefined || next === null ? [MISSING] : resolve(rest, next);
}

function check(name, args, value) {
  switch (name) {
    case "present":
      return value !== null && value !== undefined;
    case "map":
      return isMap(value);
    case "list":
      return Array.isArray(value);
    case "nonempty_list":
      return Array.isArray(value) && value.length > 0;
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return isInteger(value);
    case "number":
      return isNumber(value);
    case "string":
      return typeof value === "string";
    case "text":
      return typeof value === "string" && value !== "";
    case "eq":
      return deepEqual(value, args[0]);
    case "in":
      return args[0].some((candidate) => deepEqual(value, candidate));
    case "min":
      return isNumber(value) && value >= args[0];
    case "gt":
      return isNumber(value) && value > args[0];
    case "between":
      return isNumber(value) && value >= args[0] && value <= args[1];
    case "prefix":
      return typeof value === "string" && value.startsWith(args[0]) && value !== args[0];
    case "contains":
      return typeof value === "string" && value.includes(args[0]);
    default:
      throw new TypeError(`unknown check: ${name}`);
  }
}

// Whether one expectation holds against a JSON object body. Every leaf must
// satisfy the check; an empty fan-out passes vacuously.
export function holds(expectation, body) {
  const [path, name, ...args] = expectation;
  const results = resolve(path.split("."), body);
  if (name === "absent") return results.every((r) => r === MISSING);
  return results.every((r) => r !== MISSING && check(name, args, r));
}

// True when `body` is a JSON object satisfying every expectation.
export function ok(expectations, body) {
  if (!Array.isArray(expectations)) throw new TypeError("expectations must be a list");
  if (!isMap(body)) return false;
  return expectations.every((expectation) => holds(expectation, body));
}

// One result per expectation, for reporting: `{expectation, ok}`. When the
// body is not a JSON object every expectation fails, as in `ok`.
export function evaluate(expectations, body) {
  const object = isMap(body);
  return expectations.map((expectation) => ({ expectation, ok: object && holds(expectation, body) }));
}
