// Backend service for the Terraform landing zone:
//
//  1. Runs Floci (the local AWS emulator) as a microservice (`floci start`).
//  2. Connects to it via its S3-compatible endpoint and reads the Terraform
//     state from the backend bucket (terraform/backend.hcl.example).
//  3. Exposes the state as a graph: /api/state/graph plus resources,
//     outputs, summary, the raw state, health, and a showcase page at /.
package main

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"strconv"
	"strings"
	"syscall"
	"time"

	"state-graph/internal/floci"
	"state-graph/internal/state"
	"state-graph/internal/stateclient"
)

// config is the service's environment-driven settings (PORT, FLOCI_ENDPOINT,
// STATE_BUCKET, STATE_KEY).
type config struct {
	Port          int
	FlociEndpoint string
	StateBucket   string
	StateKey      string
}

func loadConfig() (config, error) {
	cfg := config{
		Port:          8080,
		FlociEndpoint: "http://localhost:4566",
		StateBucket:   "portfolio-terraform-state",
		StateKey:      "terraform-landing-zone/terraform.tfstate",
	}

	if v, ok := os.LookupEnv("PORT"); ok {
		port, err := strconv.Atoi(v)
		if err != nil || port < 1 || port > 65535 {
			return config{}, fmt.Errorf("invalid PORT: %s", v)
		}
		cfg.Port = port
	}

	if v, ok := os.LookupEnv("FLOCI_ENDPOINT"); ok {
		endpoint := strings.TrimRight(v, "/")
		if _, err := url.Parse(endpoint); err != nil || endpoint == "" {
			return config{}, fmt.Errorf("invalid FLOCI_ENDPOINT: %s", endpoint)
		}
		cfg.FlociEndpoint = endpoint
	}

	if v, ok := os.LookupEnv("STATE_BUCKET"); ok {
		cfg.StateBucket = v
	}
	if v, ok := os.LookupEnv("STATE_KEY"); ok {
		cfg.StateKey = v
	}
	return cfg, nil
}

type server struct {
	cfg        config
	flociChild *exec.Cmd
}

// readState returns the current state, the error to surface, and the HTTP
// status for that error (503 on a Floci read failure, 404 when no state is
// stored).
func (s *server) readState() (stateclient.Result, error, int) {
	res, err := stateclient.FetchState(s.cfg.FlociEndpoint, s.cfg.StateBucket, s.cfg.StateKey)
	if err != nil {
		return res, err, http.StatusServiceUnavailable
	}
	if !res.Found {
		return res, fmt.Errorf("terraform state not found in Floci (s3://%s/%s) — run terraform apply against Floci first", s.cfg.StateBucket, s.cfg.StateKey), http.StatusNotFound
	}
	return res, nil, http.StatusOK
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	b, err := json.Marshal(body)
	if err != nil {
		writeJSONBytes(w, http.StatusInternalServerError, []byte(`{"error":"internal server error"}`))
		return
	}
	writeJSONBytes(w, status, b)
}

func writeJSONBytes(w http.ResponseWriter, status int, body []byte) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func writeHTML(w http.ResponseWriter, body string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(body))
}

// handleState serves transform(graph) as JSON, or the read error.
func (s *server) handleState(w http.ResponseWriter, fn func(state.Graph) any) {
	res, err, status := s.readState()
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, fn(state.BuildGraph(res.State)))
}

// handleStateRaw serves the stored state document itself (the raw object
// Floci returned).
func (s *server) handleStateRaw(w http.ResponseWriter) {
	res, err, status := s.readState()
	if err != nil {
		writeJSON(w, status, map[string]string{"error": err.Error()})
		return
	}
	writeJSONBytes(w, http.StatusOK, res.Raw)
}

type healthFloci struct {
	Endpoint  string `json:"endpoint"`
	Reachable bool   `json:"reachable"`
}

type healthStateOut struct {
	Serial           *int    `json:"serial"`
	TerraformVersion *string `json:"terraformVersion"`
}

type healthResponse struct {
	Status     string          `json:"status"`
	Floci      healthFloci     `json:"floci"`
	StateFound bool            `json:"stateFound"`
	State      *healthStateOut `json:"state"`
}

func (s *server) handleHealth(w http.ResponseWriter) {
	res, _, _ := s.readState()
	resp := healthResponse{
		Status:     "ok",
		Floci:      healthFloci{Endpoint: s.cfg.FlociEndpoint, Reachable: floci.IsReachable(s.cfg.FlociEndpoint)},
		StateFound: res.Found,
	}
	if res.Found {
		resp.State = &healthStateOut{Serial: res.State.Serial, TerraformVersion: res.State.TerraformVersion}
	}
	writeJSON(w, http.StatusOK, resp)
}

func (s *server) handleShowcase(w http.ResponseWriter) {
	res, _, _ := s.readState()
	writeHTML(w, s.showcaseHTML(state.BuildGraph(res.State)))
}

var htmlReplacer = strings.NewReplacer(
	"&", "&amp;",
	"<", "&lt;",
	">", "&gt;",
	`"`, "&quot;",
	"'", "&#39;",
)

func escapeHTML(s string) string {
	return htmlReplacer.Replace(s)
}

func (s *server) showcaseHTML(graph state.Graph) string {
	var nodes strings.Builder
	for _, n := range graph.Nodes {
		nodes.WriteString(`<li><span class="addr">` + escapeHTML(n.Address) + `</span> `)
		nodes.WriteString(`<span class="badge">` + escapeHTML(n.Mode) + `</span>`)
		if len(n.DependsOn) > 0 {
			nodes.WriteString(` <span class="deps">depends on: ` + escapeHTML(strings.Join(n.DependsOn, ", ")) + `</span>`)
		}
		nodes.WriteString(`</li>`)
	}
	nodesHtml := nodes.String()
	if nodesHtml == "" {
		nodesHtml = `<li class="empty">— none yet —</li>`
	}

	var outputs strings.Builder
	for _, o := range graph.Outputs {
		outputs.WriteString(`<li><span class="addr">` + escapeHTML(o.ID) + `</span>`)
		if o.Sensitive {
			outputs.WriteString(` <span class="badge">sensitive</span>`)
		}
		outputs.WriteString(`</li>`)
	}
	outputsHtml := outputs.String()
	if outputsHtml == "" {
		outputsHtml = `<li class="empty">— none yet —</li>`
	}

	return fmt.Sprintf(`<!doctype html>
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
<p>Source: <code>s3://%s/%s</code> — <a href="/api/state/graph">/api/state/graph</a> · <a href="/api/state/summary">/api/state/summary</a> · <a href="/api/state/outputs">/api/state/outputs</a></p>
<h2>Resources (%d)</h2>
<ul>%s</ul>
<h2>Outputs (%d)</h2>
<ul>%s</ul>
</body>
</html>`, escapeHTML(s.cfg.StateBucket), escapeHTML(s.cfg.StateKey), len(graph.Nodes), nodesHtml, len(graph.Outputs), outputsHtml)
}

func (s *server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	switch path {
	case "/health", "/api/health":
		s.handleHealth(w)
	case "/api/state":
		s.handleStateRaw(w)
	case "/api/state/graph":
		s.handleState(w, func(g state.Graph) any { return g })
	case "/api/state/resources":
		s.handleState(w, func(g state.Graph) any { return map[string][]state.Node{"resources": g.Nodes} })
	case "/api/state/outputs":
		s.handleState(w, func(g state.Graph) any { return map[string][]state.OutputNode{"outputs": g.Outputs} })
	case "/api/state/summary":
		s.handleState(w, func(g state.Graph) any { return map[string]state.Summary{"summary": g.Summary} })
	case "/":
		s.handleShowcase(w)
	default:
		writeJSON(w, http.StatusNotFound, map[string]string{"error": fmt.Sprintf("no route for %s", path)})
	}
}

func main() {
	cfg, err := loadConfig()
	if err != nil {
		fmt.Fprintln(os.Stderr, "[state-graph]", err.Error())
		os.Exit(1)
	}

	fmt.Printf("[state-graph] backend service on :%d\n", cfg.Port)
	fmt.Printf("[state-graph] floci endpoint: %s\n", cfg.FlociEndpoint)
	fmt.Printf("[state-graph] state: s3://%s/%s\n", cfg.StateBucket, cfg.StateKey)

	s := &server{cfg: cfg}

	if !floci.IsReachable(cfg.FlociEndpoint) {
		s.flociChild = floci.Start(cfg.FlociEndpoint)
		ready := floci.WaitForEndpoint(cfg.FlociEndpoint, 20*time.Second, 250*time.Millisecond)
		fmt.Printf("[state-graph] floci ready: %v\n", ready)
	} else {
		fmt.Println("[state-graph] floci already running")
	}

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGTERM, syscall.SIGINT)
	go func() {
		<-sigCh
		fmt.Println("[state-graph] shutting down")
		if s.flociChild != nil && s.flociChild.Process != nil {
			_ = s.flociChild.Process.Signal(syscall.SIGTERM)
		}
		os.Exit(0)
	}()

	ln, err := net.Listen("tcp", fmt.Sprintf(":%d", cfg.Port))
	if err != nil {
		fmt.Fprintf(os.Stderr, "[state-graph] listen on :%d failed: %v\n", cfg.Port, err)
		os.Exit(1)
	}
	fmt.Printf("[state-graph] listening on http://localhost:%d\n", cfg.Port)
	fmt.Printf("[state-graph] graph: http://localhost:%d/api/state/graph\n", cfg.Port)
	fmt.Printf("[state-graph] showcase: http://localhost:%d/\n", cfg.Port)

	_ = http.Serve(ln, s)
}
