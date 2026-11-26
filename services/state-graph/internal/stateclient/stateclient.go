// Package stateclient fetches the Terraform state snapshot from the Floci
// S3-compatible endpoint. The dashboard reads the same object via plain
// fetch (see dashboard/lib/trends-state.ts), so the path-style GET below is
// the established convention for this repo.
package stateclient

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"strings"
	"time"

	"state-graph/internal/state"
)

// Result is the outcome of a FetchState call.
type Result struct {
	// Raw is the stored state document, exactly as Floci returned it.
	Raw []byte
	// State is the parsed state; nil when Found is false.
	State *state.State
	// Found reports whether a state object is stored — the reference
	// implementation treats a falsy state as "not found".
	Found bool
}

// FetchState GETs the state object at s3://bucket/key from the Floci
// endpoint, path-style. A 404 (or a falsy JSON value) means no state object
// is stored: Result{Found: false} with no error.
func FetchState(endpoint, bucket, key string) (Result, error) {
	url := strings.TrimRight(endpoint, "/") + "/" + bucket + "/" + key

	client := &http.Client{Timeout: 5 * time.Second}
	res, err := client.Get(url)
	if err != nil {
		return Result{}, fmt.Errorf("cannot reach Floci at %s: %v", url, err)
	}
	defer res.Body.Close()

	if res.StatusCode == http.StatusNotFound {
		return Result{State: &state.State{}}, nil
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return Result{}, fmt.Errorf("Floci returned %d for %s", res.StatusCode, url)
	}
	raw, err := io.ReadAll(res.Body)
	if err != nil {
		return Result{}, fmt.Errorf("Floci returned an unreadable state body at %s: %v", url, err)
	}

	var v any
	if err := json.Unmarshal(raw, &v); err != nil {
		return Result{}, fmt.Errorf("Floci returned an unreadable state body at %s: %v", url, err)
	}
	if !truthy(v) {
		return Result{State: &state.State{}}, nil
	}
	return Result{Raw: raw, State: state.Parse(raw), Found: true}, nil
}

// truthy reports whether v is truthy in JavaScript terms — the reference
// implementation reads the parsed state with `state ? ... : ...` and
// `Array.isArray(state?.resources)` checks, so null, false, 0, "" and NaN
// mean "no state"; arrays and objects mean there is one.
func truthy(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case string:
		return x != ""
	case float64:
		return x != 0 && !math.IsNaN(x)
	default:
		return true
	}
}
