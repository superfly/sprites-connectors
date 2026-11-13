// Manifest checks the JSON Schema cannot express, shared by
// scripts/check-connectors.mjs and the unit tests: the probe and every
// example must be routes the manifest forwards, expectations must be
// well-formed, path_param must compile and auth must be one of the forms
// the probe runner can send. Returns problems as strings; an empty list
// means the manifest passes.
import { compilePathParam, pathAllowed } from "./routes.mjs";
import { problem as expectationProblem } from "./expect.mjs";
import { authProblem } from "./credential.mjs";

// The gateway matches routes on the path alone; a probe or example may carry
// a query string for the request.
export function stripQuery(path) {
  const at = path.indexOf("?");
  return at === -1 ? path : path.slice(0, at);
}

function expectProblems(at, expectations) {
  if (expectations === undefined) return [];
  if (!Array.isArray(expectations) || expectations.length === 0)
    return [`${at} must be a non-empty list of [path, check, ...]`];
  const out = [];
  expectations.forEach((expectation, i) => {
    const why = expectationProblem(expectation);
    if (why) out.push(`${at}[${i}] ${why}: ${JSON.stringify(expectation)}`);
  });
  return out;
}

export function manifestProblems(manifest) {
  const problems = [];
  if (manifest.auth !== undefined) {
    const why = authProblem(manifest.auth);
    if (why) problems.push(why);
  }
  const routes = Array.isArray(manifest.allowed_paths) ? manifest.allowed_paths : [];
  let pathParam;
  if (manifest.path_param !== undefined) {
    try {
      pathParam = compilePathParam(manifest.path_param);
    } catch (error) {
      problems.push(`path_param does not compile as a JS regex: ${error.message}`);
    }
  }

  const probe = manifest.probe ?? {};
  problems.push(...expectProblems("probe.expect", probe.expect));
  (Array.isArray(probe.errors) ? probe.errors : []).forEach((rule, i) =>
    problems.push(...expectProblems(`probe.errors[${i}].expect`, rule?.expect)),
  );

  const allowed = (method, path) => {
    if (manifest.path_param !== undefined && !pathParam) return true; // reported above
    try {
      return pathAllowed(routes, method, stripQuery(path), { pathParam });
    } catch (error) {
      problems.push(`allowed_paths cannot be matched: ${error.message}`);
      return true;
    }
  };
  if (typeof probe.path === "string" && !allowed(probe.method ?? "GET", probe.path))
    problems.push(`probe ${probe.method ?? "GET"} ${probe.path} is not allowed by allowed_paths`);
  (Array.isArray(manifest.examples) ? manifest.examples : []).forEach((example, i) => {
    const method = example?.method ?? "GET";
    if (typeof example?.path === "string" && !allowed(method, example.path))
      problems.push(`examples[${i}] ${method} ${example.path} is not allowed by allowed_paths`);
  });
  return problems;
}
