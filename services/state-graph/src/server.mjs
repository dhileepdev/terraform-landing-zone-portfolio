#!/usr/bin/env node
// Backend service for the Terraform landing zone:
//   1. Runs Floci (the local AWS emulator) as a microservice (`floci start`).
//   2. Connects to it via its S3-compatible endpoint and reads the Terraform
//      state from the backend bucket (terraform/backend.hcl.example).
//   3. Exposes the state as a graph: /api/state/graph plus resources,
//      outputs, summary, the raw state, health, and a showcase page at /.

import http from "node:http";
import { fetchState } from "./state-client.mjs";
import { buildGraph } from "./state-graph.mjs";
import { flociIsReachable, startFloci, waitForEndpoint } from "./floci.mjs";

const PORT = Number(process.env.PORT ?? 8080);
const FLOCI_ENDPOINT = (process.env.FLOCI_ENDPOINT ?? "http://localhost:4566").replace(/\/+$/, "");
const STATE_BUCKET = process.env.STATE_BUCKET ?? "portfolio-terraform-state";
const STATE_KEY = process.env.STATE_KEY ?? "terraform-landing-zone/terraform.tfstate";

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`[state-graph] invalid PORT: ${process.env.PORT}`);
  process.exit(1);
}
try {
  new URL(FLOCI_ENDPOINT);
} catch {
  console.error(`[state-graph] invalid FLOCI_ENDPOINT: ${FLOCI_ENDPOINT}`);
  process.exit(1);
}

console.log(`[state-graph] backend service on :${PORT}`);
console.log(`[state-graph] floci endpoint: ${FLOCI_ENDPOINT}`);
console.log(`[state-graph] state: s3://${STATE_BUCKET}/${STATE_KEY}`);

let flociChild = null;
if (!(await flociIsReachable(FLOCI_ENDPOINT))) {
  flociChild = startFloci({ endpoint: FLOCI_ENDPOINT });
  const ready = await waitForEndpoint(FLOCI_ENDPOINT);
  console.log(`[state-graph] floci ready: ${ready}`);
} else {
  console.log("[state-graph] floci already running");
}

const shutdown = () => {
  console.log("[state-graph] shutting down");
  flociChild?.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

async function loadState() {
  return fetchState({ flociEndpoint: FLOCI_ENDPOINT, bucket: STATE_BUCKET, key: STATE_KEY });
}

async function readState() {
  let state;
  try {
    state = await loadState();
  } catch (err) {
    return { state: undefined, status: 503, error: err.message };
  }
  if (!state) {
    return {
      state: undefined,
      status: 404,
      error: `terraform state not found in Floci (s3://${STATE_BUCKET}/${STATE_KEY}) — run terraform apply against Floci first`,
    };
  }
  return { state, status: 200 };
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function html(res, body) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(body);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showcaseHtml(graph) {
  const nodesHtml = graph.nodes
    .map(
      (node) =>
        `<li><span class="addr">${escapeHtml(node.address)}</span> ` +
        `<span class="badge">${escapeHtml(node.mode ?? "")}</span>` +
        `${node.dependsOn.length ? ` <span class="deps">depends on: ${escapeHtml(node.dependsOn.join(", "))}</span>` : ""}</li>`
    )
    .join("");
  const outputsHtml = graph.outputs
    .map((output) => `<li><span class="addr">${escapeHtml(output.id)}</span>${output.sensitive ? ' <span class="badge">sensitive</span>' : ""}</li>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Terraform state graph</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 24px auto; padding: 0 16px; color: #0a0a0a; background: #f8f8f8; }
  h1 { font-size: 18px; }
  h2 { font-size: 14px; margin-top: 18px; }
  ul { list-style: none; padding: 0; margin: 6px 0; }
  li { padding: 4px 0; border-bottom: 1px solid #f0f0f0; }
  .addr { font-weight: 500; }
  .badge { font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 8px; background: #e9e9e9; color: #444; }
  .deps { color: #6b6b6b; font-size: 11px; }
  .empty { color: #6b6b6b; }
</style>
</head>
<body>
<h1>Terraform state graph</h1>
<p>Source: <code>s3://${escapeHtml(STATE_BUCKET)}/${escapeHtml(STATE_KEY)}</code> — <a href="/api/state/graph">/api/state/graph</a> · <a href="/api/state/summary">/api/state/summary</a> · <a href="/api/state/outputs">/api/state/outputs</a></p>
<h2>Resources (${graph.nodes.length})</h2>
<ul>${nodesHtml || '<li class="empty">— none yet —</li>'}</ul>
<h2>Outputs (${graph.outputs.length})</h2>
<ul>${outputsHtml || '<li class="empty">— none yet —</li>'}</ul>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const path = new URL(req.url, `http://localhost:${PORT}`).pathname;

  // Sends the graph of the current state, or the read error.
  const sendState = async (transform) => {
    const { state, status, error } = await readState();
    if (!state) {
      json(res, status, { error });
      return;
    }
    json(res, 200, transform(state));
  };

  if (path === "/health" || path === "/api/health") {
    const reachable = await flociIsReachable(FLOCI_ENDPOINT);
    const { state } = await readState();
    return json(res, 200, {
      status: "ok",
      floci: { endpoint: FLOCI_ENDPOINT, reachable },
      stateFound: state !== undefined,
      state: state
        ? { serial: state.serial ?? null, terraformVersion: state.terraform_version ?? null }
        : null,
    });
  }

  if (path === "/api/state") return sendState((state) => state);
  if (path === "/api/state/graph") return sendState((state) => buildGraph(state));
  if (path === "/api/state/resources") return sendState((state) => ({ resources: buildGraph(state).nodes }));
  if (path === "/api/state/outputs") return sendState((state) => ({ outputs: buildGraph(state).outputs }));
  if (path === "/api/state/summary") return sendState((state) => ({ summary: buildGraph(state).summary }));

  if (path === "/") {
    const { state } = await readState();
    const graph = state ? buildGraph(state) : { nodes: [], edges: [], outputs: [] };
    return html(res, showcaseHtml(graph));
  }

  json(res, 404, { error: `no route for ${path}` });
});

server.listen(PORT, () => {
  console.log(`[state-graph] listening on http://localhost:${PORT}`);
  console.log(`[state-graph] graph: http://localhost:${PORT}/api/state/graph`);
  console.log(`[state-graph] showcase: http://localhost:${PORT}/`);
});
