import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const output = path.join(root, "dist-world-sim");
const viewerSource = path.join(root, "public", "world-sim");
const dataSource = path.join(root, "public", "data", "l3-world-viewer");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assertBundleContract(manifest) {
  if (manifest.schema_version !== "l3-world-viewer-bundle/v1") {
    throw new Error(`Unsupported viewer schema: ${manifest.schema_version || "missing"}`);
  }
  const contract = manifest.data_contract;
  const layers = [...(contract?.direct_input_layers || [])].sort().join(",");
  if (contract?.contract_version !== "l3-viewer-input/v1") {
    throw new Error("Missing L3 viewer input contract");
  }
  if (layers !== "L1,L2") {
    throw new Error(`Viewer bundle must declare direct L1/L2 inputs; received ${layers || "none"}`);
  }
  if (contract.legacy_runtime_inputs !== false || contract.web_legacy_catalogs !== false) {
    throw new Error("Viewer bundle declares a legacy runtime input");
  }
}

function assertViewerUsesOnlyBundle() {
  const app = fs.readFileSync(path.join(viewerSource, "app.js"), "utf8");
  const forbidden = [
    /(?:\.\.\/)+data\/(?:groups|idols|songs|scenarios)(?:\.json|\/)/i,
    /public\/data\/(?:groups|idols|songs|scenarios)(?:\.json|\/)/i,
    /(?:^|["'`])(?:\.\.\/)*legacy\//im,
  ];
  for (const pattern of forbidden) {
    if (pattern.test(app)) throw new Error(`World Simulator contains forbidden data route: ${pattern}`);
  }
  if (!app.includes("data/l3-world-viewer")) {
    throw new Error("World Simulator does not reference the L3 viewer bundle");
  }
}

const manifestPath = path.join(dataSource, "manifest.json");
assertBundleContract(readJson(manifestPath));
assertViewerUsesOnlyBundle();

if (path.basename(output) !== "dist-world-sim" || path.dirname(output) !== root) {
  throw new Error(`Refusing to replace unexpected output path: ${output}`);
}
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, "data"), { recursive: true });
fs.cpSync(viewerSource, path.join(output, "world-sim"), { recursive: true });
fs.cpSync(dataSource, path.join(output, "data", "l3-world-viewer"), { recursive: true });
fs.writeFileSync(
  path.join(output, "index.html"),
  '<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=./world-sim/"><title>World Simulator</title><a href="./world-sim/">Open World Simulator</a>\n',
  "utf8",
);
fs.writeFileSync(path.join(output, ".nojekyll"), "", "utf8");

console.log(`World Simulator Pages artifact: ${path.relative(root, output)}`);
