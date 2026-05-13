package github

import "errors"

// Sentinel errors returned by Client. Callers map these to HTTP status codes
// via errors.Is. They are defined here (rather than in internal/repos) so the
// client stays self-contained and importable without pulling in repo code.
var (
	ErrNotFound    = errors.New("github: repository not found")
	ErrRateLimited = errors.New("github: rate limited")
	ErrUpstream    = errors.New("github: upstream failure")
)