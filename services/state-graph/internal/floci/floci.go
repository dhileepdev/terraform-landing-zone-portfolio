// Package floci runs Floci as the local AWS emulator microservice:
// `floci start` launches the container; the service supervises it and stops
// it on shutdown.
package floci

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"time"
)

// IsReachable reports whether the Floci endpoint answers an HTTP GET. The
// reference implementation's flociIsReachable treats any HTTP response as
// reachable; only network-level errors mean "not reachable".
func IsReachable(endpoint string) bool {
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Get(endpoint)
	if err != nil {
		return false
	}
	_, _ = io.Copy(io.Discard, resp.Body)
	resp.Body.Close()
	return true
}

// WaitForEndpoint polls IsReachable until the endpoint answers or the
// timeout elapses (the reference implementation defaults to 20s/250ms).
func WaitForEndpoint(endpoint string, timeout, interval time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if IsReachable(endpoint) {
			return true
		}
		time.Sleep(interval)
	}
	return false
}

// Start launches `floci start` for the endpoint, mirroring the reference
// implementation's spawn (stdio inherited). A spawn failure is reported and
// nil is returned; callers log that Floci should be started manually.
func Start(endpoint string) *exec.Cmd {
	cmd := exec.Command("floci", "start", "--endpoint", endpoint)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		fmt.Printf("[state-graph] could not run floci: %v — start Floci manually? (curl -fsSL https://floci.io/install.sh | sh)\n", err)
		return nil
	}
	return cmd
}
