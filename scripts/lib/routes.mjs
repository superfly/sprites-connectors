// Port of the gateway's route matcher: `Sprites.Gateway.OAuthProvider.path_allowed?/3`
// and its helpers, plus `Sprites.Gateway.AccessPolicy.path_matches_any?/2` and
// `Sprites.Gateway.Connector.safe_path?/1` in sprites-api. v1/vectors.json is
// the parity contract between the two; keep this file in step with the Elixir
// rather than improving it on its own.
//
// A manifest's `allowed_paths` entry is either a bare pattern string, which
// allows every method, or `{methods, pattern}`, which allows only the listed
// upper-case methods. A pattern is one of:
//
//   - an exact path: `/v1/models` matches only `/v1/models`;
//   - a prefix ending in `*`: `/v1/*` matches every path starting with `/v1/`
//     (so `/v1/` and `/v1/x`, but not `/v1`);
//   - a path with `:name` segments: each matches one segment of
//     `[A-Za-z0-9_-]+` (or the manifest's `path_param` regex), never a segment
//     that another route uses literally at that position when that route's
//     earlier segments also fit the path, and a trailing `*` after a parameter
//     matches any non-empty remainder. Such paths must also pass `safePath`.

export const DEFAULT_PATH_PARAM = "\\A[A-Za-z0-9_-]+\\z";

// `\A` and `\z` are PCRE anchors with no JS spelling; the manifest requires
// them, so translate the two anchors and compile the rest as-is. JS and PCRE
// agree on the character classes, quantifiers and groups a path parameter
// needs. Throws (like `Regex.compile/1`) when the source is not a regex.
export function compilePathParam(source) {
  if (typeof source !== "string") throw new TypeError("path_param must be a string");
  if (!source.startsWith("\\A") || !source.endsWith("\\z"))
    throw new SyntaxError("path_param must be anchored with \\A and \\z");
  return new RegExp(`^(?:${source.slice(2, -2)})$`);
}

// True when a gateway path has no encoded separators or dots, backslashes,
// dot segments or empty segments (`Sprites.Gateway.Connector.safe_path?/1`).
export function safePath(path) {
  return (
    !/%(?:2f|5c|2e|25)/i.test(path) &&
    !path.includes("\\") &&
    !path.includes("//") &&
    path.split("/").filter((s) => s !== "").every((s) => s !== "." && s !== "..")
  );
}

// `Sprites.Gateway.AccessPolicy.path_matches_pattern?/2`: exact match, or a
// prefix match for a trailing `*`. A legacy `.*` suffix is also a prefix
// match, with backslash escapes stripped from the prefix.
export function accessPolicyMatches(path, pattern) {
  if (pattern.endsWith(".*")) return path.startsWith(pattern.slice(0, -2).replaceAll("\\", ""));
  if (pattern.endsWith("*")) return path.startsWith(pattern.slice(0, -1));
  return path === pattern;
}

function normalizeRoute(entry) {
  if (typeof entry === "string") return { methods: null, pattern: entry };
  if (entry && typeof entry === "object" && Array.isArray(entry.methods) && typeof entry.pattern === "string")
    return { methods: entry.methods, pattern: entry.pattern };
  throw new TypeError(`allowed_paths entry must be a pattern or {methods, pattern}: ${JSON.stringify(entry)}`);
}

// Whether `routes` (a manifest's `allowed_paths`) forward `method` `path`.
// `method` is an upper-case string such as "DELETE" (any case is accepted and
// upper-cased); `null` matches any method. `options.pathParam` is the manifest's
// `path_param` source, or a compiled RegExp. An empty route list allows
// everything, as in the Elixir; the manifest format forbids it.
export function pathAllowed(routes, method, path, options = {}) {
  if (typeof path !== "string") throw new TypeError("path must be a string");
  const entries = routes.map(normalizeRoute);
  if (entries.length === 0) return true;
  const params = {
    regex:
      options.pathParam instanceof RegExp
        ? options.pathParam
        : compilePathParam(options.pathParam ?? DEFAULT_PATH_PARAM),
    routes: entries.map((e) => e.pattern.split("/")),
  };
  const wanted = method == null ? null : String(method).toUpperCase();
  return entries.some(
    ({ methods, pattern }) =>
      (wanted === null || methods === null || methods.includes(wanted)) &&
      patternAllows(pattern, path, params),
  );
}

function patternAllows(pattern, path, params) {
  if (pattern.includes("/:")) return paramRouteAllows(pattern.split("/"), path, params);
  return accessPolicyMatches(path, pattern);
}

function paramRouteAllows(patternSegments, path, params) {
  const pathSegments = path.split("/");
  return safePath(path) && segmentsMatch(patternSegments, pathSegments, 0, pathSegments, params);
}

// Like a prefix pattern, `*` needs the separator before it: `/a/:id/*`
// matches `/a/x/` and `/a/x/y`, not `/a/x`.
function segmentsMatch(pattern, path, index, all, params) {
  if (pattern.length === 1 && pattern[0] === "*" && path.length >= 1) return true;
  if (pattern.length === 0) return path.length === 0;
  if (path.length === 0) return false;
  const [head, ...restPattern] = pattern;
  const [segment, ...restPath] = path;
  if (head.startsWith(":")) {
    return (
      params.regex.test(segment) &&
      !reserved(params.routes, all, index, segment, params.regex) &&
      segmentsMatch(restPattern, restPath, index + 1, all, params)
    );
  }
  return head === segment && segmentsMatch(restPattern, restPath, index + 1, all, params);
}

// A segment is reserved when another route uses it literally at this
// position and that route's earlier segments also fit the path, so
// `/jobs/cancel` competes with `/jobs/:id` but `/agents/:id/state` does not
// reach `/trust/advisories/:slug`.
function reserved(routes, pathSegments, index, segment, regex) {
  return routes.some(
    (route) =>
      route[index] === segment && prefixFits(route.slice(0, index), pathSegments.slice(0, index), regex),
  );
}

function prefixFits(routePrefix, pathPrefix, regex) {
  return (
    routePrefix.length === pathPrefix.length &&
    routePrefix.every((literal, i) =>
      literal.startsWith(":") ? regex.test(pathPrefix[i]) : literal === pathPrefix[i],
    )
  );
}
