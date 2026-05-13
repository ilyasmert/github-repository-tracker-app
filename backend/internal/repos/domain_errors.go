package repos

import "errors"

// Domain-level sentinel errors for the tracked-repo feature. Callers (the
// service and HTTP layers) match these with errors.Is to translate persistence
// outcomes into domain or HTTP semantics.
var (
	ErrNotFound  = errors.New("repos: tracked repo not found")
	ErrDuplicate = errors.New("repos: tracked repo already exists")
)