// Package state builds a node/edge graph from a Terraform state snapshot
// (state format v4).
//
// State v4 shape (see Terraform's internal/states/statefile/version4.go):
//
//	{
//	  "version": 4,
//	  "terraform_version": "…",
//	  "serial": 42,
//	  "lineage": "…",
//	  "outputs": {
//	    "vpc_id": { "value": "vpc-…", "type": "string", "sensitive": false }
//	  },
//	  "resources": [
//	    {
//	      "module": "module.app",              // optional module instance address
//	      "mode": "managed" | "data",
//	      "type": "aws_vpc",
//	      "name": "main",
//	      "provider": "provider[\"registry.terraform.io/hashicorp/aws\"]",
//	      "instances": [
//	        { "attributes": { … }, "dependencies": ["aws_subnet.public"] }
//	      ]
//	    }
//	  ]
//	}
//
// In v4, dependencies are recorded on resources[].instances[].dependencies
// (the instance objects carry the address of each dependency), so the graph's
// edges are built from there: `from` = the resource, `to` = the dependency.
package state

import (
	"bytes"
	"encoding/json"
	"sort"
	"strings"
)

// State is a Terraform state snapshot (state format v4). Pointer fields
// distinguish "missing" from the zero value, mirroring the reference
// implementation's `?? null` / `?? 4` defaults in summaries and health.
type State struct {
	Version          *int        `json:"version"`
	TerraformVersion *string     `json:"terraform_version"`
	Serial           *int        `json:"serial"`
	Lineage          *string     `json:"lineage"`
	Resources        []*Resource `json:"resources"`
	Outputs          []*Output   `json:"-"` // ordered as they appear in the JSON object
}

// Resource is one entry of state.resources.
type Resource struct {
	Address   any         `json:"address"`
	Module    string      `json:"module"`
	Mode      string      `json:"mode"`
	Type      string      `json:"type"`
	Name      string      `json:"name"`
	Provider  string      `json:"provider"`
	Instances []*Instance `json:"instances"`
}

// Instance is one entry of resource.instances.
type Instance struct {
	Dependencies []any `json:"dependencies"`
}

// Output is one entry of state.outputs, keyed by its name in the state JSON.
type Output struct {
	Name      string
	Value     any
	Sensitive bool
}

// Node is a resource vertex of the graph.
type Node struct {
	ID        string   `json:"id"`
	Address   string   `json:"address"`
	Type      string   `json:"type"`
	Name      string   `json:"name"`
	Mode      string   `json:"mode"`
	Provider  string   `json:"provider"`
	Instances int      `json:"instances"`
	DependsOn []string `json:"dependsOn"`
}

// Edge is a dependency edge of the graph.
type Edge struct {
	From string `json:"from"`
	To   string `json:"to"`
	Kind string `json:"kind"`
}

// OutputNode is a graph vertex for a state output.
type OutputNode struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Sensitive bool   `json:"sensitive"`
	Value     any    `json:"value"`
}

// Summary holds aggregate counts for a state graph.
type Summary struct {
	Version          int     `json:"version"`
	TerraformVersion *string `json:"terraformVersion"`
	Serial           int     `json:"serial"`
	Lineage          *string `json:"lineage"`
	Managed          int     `json:"managed"`
	Data             int     `json:"data"`
	Outputs          int     `json:"outputs"`
	Nodes            int     `json:"nodes"`
	Edges            int     `json:"edges"`
	ByType           ByType  `json:"byType"`
}

// Graph is a node/edge graph plus outputs and a summary.
type Graph struct {
	Nodes   []Node       `json:"nodes"`
	Edges   []Edge       `json:"edges"`
	Outputs []OutputNode `json:"outputs"`
	Summary Summary      `json:"summary"`
}

// Parse decodes a state document. It returns an empty State when the document
// is not a state object — the reference implementation's
// `state ? buildGraph(state) : {nodes: [], edges: [], outputs: []}`.
func Parse(raw []byte) *State {
	var s State
	if err := json.Unmarshal(raw, &s); err != nil {
		return &State{}
	}
	return &s
}

// UnmarshalJSON decodes the state document and records the outputs in
// object-key order: the reference implementation reads them with
// JSON.parse + Object.entries, which preserve insertion order, so the Go
// version must too.
func (s *State) UnmarshalJSON(data []byte) error {
	type plain State
	if err := json.Unmarshal(data, (*plain)(s)); err != nil {
		return err
	}
	return s.parseOutputs(data)
}

func (s *State) parseOutputs(data []byte) error {
	var top struct {
		Outputs json.RawMessage `json:"outputs"`
	}
	if err := json.Unmarshal(data, &top); err != nil {
		return err
	}
	dec := json.NewDecoder(bytes.NewReader(top.Outputs))
	tok, err := dec.Token()
	if err != nil {
		return nil
	}
	if d, ok := tok.(json.Delim); !ok || d != '{' {
		return nil
	}
	byName := make(map[string]*Output)
	for dec.More() {
		keyTok, err := dec.Token()
		if err != nil {
			return err
		}
		name, ok := keyTok.(string)
		if !ok {
			continue
		}
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			return err
		}
		var m map[string]json.RawMessage
		if json.Unmarshal(raw, &m) != nil || m == nil {
			continue // non-object outputs are skipped, like the reference impl
		}
		o, exists := byName[name]
		if !exists {
			o = &Output{Name: name}
			byName[name] = o
			s.Outputs = append(s.Outputs, o)
		}
		applyOutput(o, m)
	}
	return nil
}

func applyOutput(o *Output, m map[string]json.RawMessage) {
	if v, ok := m["value"]; ok {
		_ = json.Unmarshal(v, &o.Value)
	}
	if s, ok := m["sensitive"]; ok {
		var b bool
		if json.Unmarshal(s, &b) == nil {
			o.Sensitive = b
		}
	}
}

// BuildGraph derives the node/edge graph, outputs, and summary for a state.
func BuildGraph(s *State) Graph {
	if s == nil {
		s = &State{}
	}
	nodes := []Node{}
	seen := make(map[string]bool)
	for _, r := range s.Resources {
		if r == nil {
			continue
		}
		address := resourceAddress(r)
		if address == "" || seen[address] {
			continue
		}
		seen[address] = true

		deps := make(map[string]bool)
		for _, inst := range r.Instances {
			if inst == nil {
				continue
			}
			for _, d := range inst.Dependencies {
				dep, ok := d.(string)
				if !ok || dep == "" || dep == address {
					continue
				}
				deps[dep] = true
			}
		}
		dependsOn := make([]string, 0, len(deps))
		for dep := range deps {
			dependsOn = append(dependsOn, dep)
		}
		sort.Strings(dependsOn)

		nodes = append(nodes, Node{
			ID:        address,
			Address:   address,
			Type:      r.Type,
			Name:      r.Name,
			Mode:      r.Mode,
			Provider:  r.Provider,
			Instances: len(r.Instances),
			DependsOn: dependsOn,
		})
	}

	edges := []Edge{}
	byType := ByType{}
	managed, data := 0, 0
	for _, n := range nodes {
		switch n.Mode {
		case "managed":
			managed++
		case "data":
			data++
		}
		byType.add(n.Type)
		for _, dep := range n.DependsOn {
			edges = append(edges, Edge{From: n.Address, To: dep, Kind: "dependencies"})
		}
	}

	outputs := []OutputNode{}
	for _, o := range s.Outputs {
		outputs = append(outputs, OutputNode{
			ID:        "output." + o.Name,
			Name:      o.Name,
			Sensitive: o.Sensitive,
			Value:     o.Value,
		})
	}

	summary := Summary{
		Version:          4,
		TerraformVersion: s.TerraformVersion,
		Serial:           0,
		Lineage:          s.Lineage,
		Managed:          managed,
		Data:             data,
		Outputs:          len(outputs),
		Nodes:            len(nodes),
		Edges:            len(edges),
		ByType:           byType,
	}
	if s.Version != nil {
		summary.Version = *s.Version
	}
	if s.Serial != nil {
		summary.Serial = *s.Serial
	}

	return Graph{Nodes: nodes, Edges: edges, Outputs: outputs, Summary: summary}
}

// resourceAddress returns the resource's address: the explicit address when
// present, else module + type + name joined with "." (the reference
// implementation's `[resource.module, resource.type, resource.name].filter(Boolean).join(".")`).
func resourceAddress(r *Resource) string {
	if addr, ok := r.Address.(string); ok && addr != "" {
		return addr
	}
	parts := make([]string, 0, 3)
	for _, p := range []string{r.Module, r.Type, r.Name} {
		if p != "" {
			parts = append(parts, p)
		}
	}
	return strings.Join(parts, ".")
}

// ByType counts resources by type, preserving first-seen order like the
// reference implementation's `byType` object literal.
type ByType struct {
	order  []string
	counts map[string]int
}

func (b *ByType) add(t string) {
	if b.counts == nil {
		b.counts = make(map[string]int)
	}
	if _, ok := b.counts[t]; !ok {
		b.order = append(b.order, t)
	}
	b.counts[t]++
}

// MarshalJSON emits the counts in first-seen order.
func (b ByType) MarshalJSON() ([]byte, error) {
	var buf bytes.Buffer
	buf.WriteByte('{')
	for i, t := range b.order {
		if i > 0 {
			buf.WriteByte(',')
		}
		key, err := json.Marshal(t)
		if err != nil {
			return nil, err
		}
		buf.Write(key)
		buf.WriteByte(':')
		val, err := json.Marshal(b.counts[t])
		if err != nil {
			return nil, err
		}
		buf.Write(val)
	}
	buf.WriteByte('}')
	return buf.Bytes(), nil
}
