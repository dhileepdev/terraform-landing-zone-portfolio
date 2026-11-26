package state

import (
	"encoding/json"
	"reflect"
	"testing"
)

// sampleStateJSON is the same state used by the reference implementation's
// unit tests (state-graph.test.mjs).
const sampleStateJSON = `{
  "version": 4,
  "terraform_version": "1.9.0",
  "serial": 42,
  "lineage": "e2e0d3c2-1111-2222-3333-444455556666",
  "outputs": {
    "vpc_id": { "value": "vpc-0a1b2c3d4e5f60001", "type": "string", "sensitive": false },
    "public_subnets": { "value": ["subnet-0a", "subnet-0b"], "type": "list(string)" }
  },
  "resources": [
    {
      "mode": "managed",
      "type": "aws_vpc",
      "name": "main",
      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
      "instances": [{ "schema_version": 0, "attributes": { "id": "vpc-0a1b2c3d4e5f60001", "cidr_block": "10.0.0.0/16" } }]
    },
    {
      "mode": "managed",
      "type": "aws_subnet",
      "name": "public",
      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
      "instances": [
        { "schema_version": 0, "attributes": { "id": "subnet-0a" }, "dependencies": ["aws_vpc.main"] },
        { "schema_version": 0, "attributes": { "id": "subnet-0b" }, "dependencies": ["aws_vpc.main"] }
      ]
    },
    {
      "mode": "managed",
      "type": "aws_internet_gateway",
      "name": "main",
      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
      "instances": [{ "schema_version": 0, "attributes": { "id": "igw-0a1b2c3d" }, "dependencies": ["aws_vpc.main"] }]
    },
    {
      "mode": "data",
      "type": "aws_availability_zones",
      "name": "available",
      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
      "instances": [{ "schema_version": 0, "attributes": { "names": ["ap-southeast-2a", "ap-southeast-2b"] } }]
    }
  ]
}`

func mustUnmarshalState(t *testing.T, doc string) *State {
	t.Helper()
	var st State
	if err := json.Unmarshal([]byte(doc), &st); err != nil {
		t.Fatalf("unmarshal state: %v", err)
	}
	return &st
}

func mustJSON(t *testing.T, v any) string {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return string(b)
}

func TestBuildGraphSampleState(t *testing.T) {
	g := BuildGraph(mustUnmarshalState(t, sampleStateJSON))

	// Nodes: address, mode, instance count (the reference test's assertions).
	type nodeInfo struct {
		address   string
		mode      string
		instances int
	}
	got := make([]nodeInfo, 0, len(g.Nodes))
	for _, n := range g.Nodes {
		got = append(got, nodeInfo{n.Address, n.Mode, n.Instances})
	}
	want := []nodeInfo{
		{"aws_vpc.main", "managed", 1},
		{"aws_subnet.public", "managed", 2},
		{"aws_internet_gateway.main", "managed", 1},
		{"aws_availability_zones.available", "data", 1},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("nodes = %+v, want %+v", got, want)
	}

	wantEdges := []Edge{
		{From: "aws_subnet.public", To: "aws_vpc.main", Kind: "dependencies"},
		{From: "aws_internet_gateway.main", To: "aws_vpc.main", Kind: "dependencies"},
	}
	if !reflect.DeepEqual(g.Edges, wantEdges) {
		t.Errorf("edges = %+v, want %+v", g.Edges, wantEdges)
	}

	if len(g.Outputs) != 2 {
		t.Fatalf("len(outputs) = %d, want 2", len(g.Outputs))
	}
	if g.Outputs[0].ID != "output.vpc_id" || g.Outputs[0].Name != "vpc_id" || g.Outputs[0].Sensitive {
		t.Errorf("outputs[0] = %+v", g.Outputs[0])
	}
	if g.Outputs[0].Value != "vpc-0a1b2c3d4e5f60001" {
		t.Errorf("outputs[0].Value = %#v", g.Outputs[0].Value)
	}
	if !reflect.DeepEqual(g.Outputs[1].Value, []any{"subnet-0a", "subnet-0b"}) {
		t.Errorf("outputs[1].Value = %#v", g.Outputs[1].Value)
	}

	// The summary serializes identically to the reference implementation's
	// expected object, including byType's first-seen order.
	wantSummary := `{"version":4,"terraformVersion":"1.9.0","serial":42,"lineage":"e2e0d3c2-1111-2222-3333-444455556666","managed":3,"data":1,"outputs":2,"nodes":4,"edges":2,"byType":{"aws_vpc":1,"aws_subnet":1,"aws_internet_gateway":1,"aws_availability_zones":1}}`
	if got := mustJSON(t, g.Summary); got != wantSummary {
		t.Errorf("summary =\n%s\nwant\n%s", got, wantSummary)
	}
}

func TestBuildGraphEmptyState(t *testing.T) {
	g := BuildGraph(mustUnmarshalState(t, `{"version": 4, "resources": []}`))
	if len(g.Nodes) != 0 || len(g.Edges) != 0 || len(g.Outputs) != 0 {
		t.Errorf("empty graph should have no nodes/edges/outputs: %+v", g)
	}
	if g.Summary.Nodes != 0 || g.Summary.Edges != 0 || g.Summary.Outputs != 0 || g.Summary.Managed != 0 || g.Summary.Data != 0 {
		t.Errorf("empty summary: %+v", g.Summary)
	}
	if g.Summary.Version != 4 {
		t.Errorf("summary.version = %d, want 4 (default)", g.Summary.Version)
	}
	if got := mustJSON(t, g.Summary.ByType); got != "{}" {
		t.Errorf("byType = %s, want {}", got)
	}
}

func TestBuildGraphComposesAddressFromModuleTypeName(t *testing.T) {
	g := BuildGraph(mustUnmarshalState(t, `{"resources": [{"module": "module.app", "mode": "managed", "type": "aws_s3_bucket", "name": "data", "instances": [{}]}]}`))
	if len(g.Nodes) != 1 || g.Nodes[0].Address != "module.app.aws_s3_bucket.data" {
		t.Errorf("nodes = %+v", g.Nodes)
	}
}

func TestBuildGraphPrefersExplicitAddress(t *testing.T) {
	g := BuildGraph(mustUnmarshalState(t, `{"resources": [{"address": "custom.addr", "mode": "managed", "type": "aws_x", "name": "y", "instances": []}]}`))
	if len(g.Nodes) != 1 || g.Nodes[0].Address != "custom.addr" {
		t.Errorf("nodes = %+v", g.Nodes)
	}
}

func TestBuildGraphDropsSelfDependencies(t *testing.T) {
	g := BuildGraph(mustUnmarshalState(t, `{"resources": [
		{"mode": "managed", "type": "aws_a", "name": "a", "instances": [{"dependencies": ["aws_a.a", "aws_b.b"]}]},
		{"mode": "managed", "type": "aws_b", "name": "b", "instances": [{}]}
	]}`))
	if !reflect.DeepEqual(g.Nodes[0].DependsOn, []string{"aws_b.b"}) {
		t.Errorf("nodes[0].dependsOn = %v", g.Nodes[0].DependsOn)
	}
	wantEdges := []Edge{{From: "aws_a.a", To: "aws_b.b", Kind: "dependencies"}}
	if !reflect.DeepEqual(g.Edges, wantEdges) {
		t.Errorf("edges = %+v, want %+v", g.Edges, wantEdges)
	}
}

func TestBuildGraphSortsAndDeduplicatesDependencies(t *testing.T) {
	g := BuildGraph(mustUnmarshalState(t, `{"resources": [
		{"mode": "managed", "type": "aws_a", "name": "a", "instances": [{"dependencies": ["aws_c.c", "aws_b.b", "aws_c.c", ""]}]},
		{"mode": "managed", "type": "aws_b", "name": "b", "instances": []},
		{"mode": "managed", "type": "aws_c", "name": "c", "instances": []}
	]}`))
	if !reflect.DeepEqual(g.Nodes[0].DependsOn, []string{"aws_b.b", "aws_c.c"}) {
		t.Errorf("dependsOn = %v", g.Nodes[0].DependsOn)
	}
	wantEdges := []Edge{
		{From: "aws_a.a", To: "aws_b.b", Kind: "dependencies"},
		{From: "aws_a.a", To: "aws_c.c", Kind: "dependencies"},
	}
	if !reflect.DeepEqual(g.Edges, wantEdges) {
		t.Errorf("edges = %+v, want %+v", g.Edges, wantEdges)
	}
}

func TestStateOutputsKeepJSONOrder(t *testing.T) {
	st := mustUnmarshalState(t, `{"outputs": {"zeta": {"value": 1}, "alpha": {"value": 2}, "mid": {"value": 3}}}`)
	var names []string
	for _, o := range st.Outputs {
		names = append(names, o.Name)
	}
	if !reflect.DeepEqual(names, []string{"zeta", "alpha", "mid"}) {
		t.Errorf("output names = %v, want [zeta alpha mid]", names)
	}
}

func TestStateOutputSensitiveFlag(t *testing.T) {
	st := mustUnmarshalState(t, `{"outputs": {"a": {"value": 1, "sensitive": true}, "b": {"value": 2}}}`)
	if len(st.Outputs) != 2 || !st.Outputs[0].Sensitive || st.Outputs[1].Sensitive {
		t.Errorf("sensitive flags = %+v", st.Outputs)
	}
	// `1` is not `true` — sensitive must be the boolean true, like
	// `output.sensitive === true` in the reference implementation.
	st = mustUnmarshalState(t, `{"outputs": {"a": {"value": 1, "sensitive": 1}}}`)
	if st.Outputs[0].Sensitive {
		t.Errorf("sensitive should be false for non-boolean input")
	}
}
