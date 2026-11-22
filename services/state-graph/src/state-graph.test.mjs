import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGraph } from "./state-graph.mjs";

const PROVIDER = "provider[\"registry.terraform.io/hashicorp/aws\"]";

const SAMPLE_STATE = {
  version: 4,
  terraform_version: "1.9.0",
  serial: 42,
  lineage: "e2e0d3c2-1111-2222-3333-444455556666",
  outputs: {
    vpc_id: { value: "vpc-0a1b2c3d4e5f60001", type: "string", sensitive: false },
    public_subnets: { value: ["subnet-0a", "subnet-0b"], type: "list(string)" },
  },
  resources: [
    {
      mode: "managed",
      type: "aws_vpc",
      name: "main",
      provider: PROVIDER,
      instances: [{ schema_version: 0, attributes: { id: "vpc-0a1b2c3d4e5f60001", cidr_block: "10.0.0.0/16" } }],
    },
    {
      mode: "managed",
      type: "aws_subnet",
      name: "public",
      provider: PROVIDER,
      instances: [
        { schema_version: 0, attributes: { id: "subnet-0a" }, dependencies: ["aws_vpc.main"] },
        { schema_version: 0, attributes: { id: "subnet-0b" }, dependencies: ["aws_vpc.main"] },
      ],
    },
    {
      mode: "managed",
      type: "aws_internet_gateway",
      name: "main",
      provider: PROVIDER,
      instances: [{ schema_version: 0, attributes: { id: "igw-0a1b2c3d" }, dependencies: ["aws_vpc.main"] }],
    },
    {
      mode: "data",
      type: "aws_availability_zones",
      name: "available",
      provider: PROVIDER,
      instances: [{ schema_version: 0, attributes: { names: ["ap-southeast-2a", "ap-southeast-2b"] } }],
    },
  ],
};

test("buildGraph: nodes, edges, outputs and summary from a v4 state", () => {
  const { nodes, edges, outputs, summary } = buildGraph(SAMPLE_STATE);

  assert.deepEqual(nodes.map((n) => n.address), [
    "aws_vpc.main",
    "aws_subnet.public",
    "aws_internet_gateway.main",
    "aws_availability_zones.available",
  ]);
  assert.deepEqual(
    nodes.map((n) => ({ address: n.address, mode: n.mode, instances: n.instances })),
    [
      { address: "aws_vpc.main", mode: "managed", instances: 1 },
      { address: "aws_subnet.public", mode: "managed", instances: 2 },
      { address: "aws_internet_gateway.main", mode: "managed", instances: 1 },
      { address: "aws_availability_zones.available", mode: "data", instances: 1 },
    ]
  );
  assert.deepEqual(edges, [
    { from: "aws_subnet.public", to: "aws_vpc.main", kind: "dependencies" },
    { from: "aws_internet_gateway.main", to: "aws_vpc.main", kind: "dependencies" },
  ]);
  assert.deepEqual(
    outputs.map((o) => ({ id: o.id, name: o.name, sensitive: o.sensitive })),
    [
      { id: "output.vpc_id", name: "vpc_id", sensitive: false },
      { id: "output.public_subnets", name: "public_subnets", sensitive: false },
    ]
  );
  assert.equal(outputs[0].value, "vpc-0a1b2c3d4e5f60001");
  assert.deepEqual(outputs[1].value, ["subnet-0a", "subnet-0b"]);
  assert.deepEqual(summary, {
    version: 4,
    terraformVersion: "1.9.0",
    serial: 42,
    lineage: "e2e0d3c2-1111-2222-3333-444455556666",
    managed: 3,
    data: 1,
    outputs: 2,
    nodes: 4,
    edges: 2,
    byType: {
      aws_vpc: 1,
      aws_subnet: 1,
      aws_internet_gateway: 1,
      aws_availability_zones: 1,
    },
  });
});

test("buildGraph: empty state produces empty graph", () => {
  const { nodes, edges, outputs, summary } = buildGraph({ version: 4, resources: [] });
  assert.deepEqual(nodes, []);
  assert.deepEqual(edges, []);
  assert.deepEqual(outputs, []);
  assert.equal(summary.nodes, 0);
  assert.equal(summary.edges, 0);
  assert.equal(summary.outputs, 0);
  assert.equal(summary.managed, 0);
  assert.deepEqual(summary.byType, {});
});

test("buildGraph: composes addresses from module/type/name when absent", () => {
  const { nodes } = buildGraph({
    resources: [{ module: "module.app", mode: "managed", type: "aws_s3_bucket", name: "data", instances: [{}] }],
  });
  assert.deepEqual(nodes.map((n) => n.address), ["module.app.aws_s3_bucket.data"]);
});

test("buildGraph: prefers an explicit address field", () => {
  const { nodes } = buildGraph({
    resources: [{ address: "custom.addr", mode: "managed", type: "aws_x", name: "y", instances: [] }],
  });
  assert.deepEqual(nodes.map((n) => n.address), ["custom.addr"]);
});

test("buildGraph: self-dependencies are dropped", () => {
  const { nodes, edges } = buildGraph({
    resources: [
      {
        mode: "managed",
        type: "aws_a",
        name: "a",
        instances: [{ dependencies: ["aws_a.a", "aws_b.b"] }],
      },
      { mode: "managed", type: "aws_b", name: "b", instances: [{}] },
    ],
  });
  assert.deepEqual(nodes[0].dependsOn, ["aws_b.b"]);
  assert.deepEqual(edges, [{ from: "aws_a.a", to: "aws_b.b", kind: "dependencies" }]);
});
