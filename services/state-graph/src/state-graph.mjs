// Builds a node/edge graph from a Terraform state snapshot (state format v4).
//
// State v4 shape (see terraform's internal/states/statefile/version4.go):
//   {
//     "version": 4,
//     "terraform_version": "1.9.0",
//     "serial": 42,
//     "lineage": "…",
//     "outputs": {
//       "vpc_id": { "value": "vpc-…", "type": "string", "sensitive": false }
//     },
//     "resources": [
//       {
//         "module": "module.app",              // optional module instance address
//         "mode": "managed" | "data",
//         "type": "aws_vpc",
//         "name": "main",
//         "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
//         "instances": [
//           { "attributes": { … }, "dependencies": ["aws_subnet.public"] }
//         ]
//       }
//     ]
//   }
//
// In v4, dependencies are recorded on `resources[].instances[].dependencies`
// (the instance objects carry the address of each dependency), so the graph's
// edges are built from there: `from` = the resource, `to` = the dependency
// (the resource is recorded as depending on the target).

function resourceAddress(resource) {
  if (typeof resource.address === "string" && resource.address) return resource.address;
  return [resource.module, resource.type, resource.name].filter(Boolean).join(".");
}

function outputValue(output) {
  // The state JSON carries the output's `value` already parsed (it is raw
  // JSON in the file, decoded by the state reader).
  return output?.value === undefined ? null : output.value;
}

export function buildGraph(state) {
  const resources = Array.isArray(state?.resources) ? state.resources : [];
  const nodes = [];
  const seen = new Set();

  for (const resource of resources) {
    if (!resource || typeof resource !== "object") continue;
    const address = resourceAddress(resource);
    if (!address || seen.has(address)) continue;
    seen.add(address);

    const dependsOn = new Set();
    for (const instance of Array.isArray(resource.instances) ? resource.instances : []) {
      for (const dep of instance?.dependencies ?? []) {
        if (typeof dep === "string" && dep && dep !== address) dependsOn.add(dep);
      }
    }

    nodes.push({
      id: address,
      address,
      type: resource.type,
      name: resource.name,
      mode: resource.mode,
      provider: resource.provider,
      instances: Array.isArray(resource.instances) ? resource.instances.length : 0,
      dependsOn: [...dependsOn].sort(),
    });
  }

  const edges = [];
  for (const node of nodes) {
    for (const dep of node.dependsOn) {
      edges.push({ from: node.address, to: dep, kind: "dependencies" });
    }
  }

  const outputs = [];
  for (const [name, output] of Object.entries(state?.outputs ?? {})) {
    if (!output || typeof output !== "object") continue;
    outputs.push({
      id: `output.${name}`,
      name,
      sensitive: output.sensitive === true,
      value: outputValue(output),
    });
  }

  const byType = {};
  for (const node of nodes) byType[node.type] = (byType[node.type] ?? 0) + 1;

  return {
    nodes,
    edges,
    outputs,
    summary: {
      version: state?.version ?? 4,
      terraformVersion: state?.terraform_version ?? null,
      serial: state?.serial ?? 0,
      lineage: state?.lineage ?? null,
      managed: nodes.filter((n) => n.mode === "managed").length,
      data: nodes.filter((n) => n.mode === "data").length,
      outputs: outputs.length,
      nodes: nodes.length,
      edges: edges.length,
      byType,
    },
  };
}
