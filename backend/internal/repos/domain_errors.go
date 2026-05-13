package repos

import (
	"errors"
	"fmt"
)

// Domain-level sentinel errors for the tracked-repo feature. Callers (HTTP
// handlers in particular) match these with errors.Is to translate persistence
// or upstream outcomes into HTTP semantics.
var (
	ErrNotFound          = errors.New("repos: tracked repo not found")
	ErrDuplicate         = errors.New("repos: tracked repo already exists")
	ErrGitHubNotFound    = errors.New("repos: github repository not found")
	ErrGitHubRateLimited = errors.New("repos: github rate limited")
	ErrUpstream          = errors.New("repos: github upstream failure")
)

// ValidationError carries a structured validation failure (field + reason) so
// the HTTP layer can render a useful 400 without re-parsing strings.
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation: %s: %s", e.Field, e.Message)
}
