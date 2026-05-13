// Package apierror renders the JSON error envelope used across every API
// response. It lives in its own package so handlers and middleware can use it
// without creating an import cycle with the httpapi router.
package apierror

import (
	"errors"
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/ilyas/repository-tracker-app/backend/internal/repos"
)

// body is the canonical error envelope:
//
//	{"error": {"code": "...", "message": "...", "field": "..."}}
//
// `field` is only emitted for validation errors that target a specific input.
type body struct {
	Error payload `json:"error"`
}

type payload struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

// Render writes a JSON error envelope for err and aborts the gin context.
// Domain sentinels in internal/repos are mapped to specific status codes;
// anything unrecognised is reported as 500 INTERNAL and logged so the
// underlying cause is not silently dropped.
func Render(c *gin.Context, err error) {
	status, p := classify(err)
	if status == http.StatusInternalServerError {
		slog.Error("unhandled api error",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"err", err.Error(),
		)
	}
	c.AbortWithStatusJSON(status, body{Error: p})
}

// Validation is a shortcut for transport-level validation failures (malformed
// JSON, bad query params, bad path segments) that don't originate from the
// service layer.
func Validation(c *gin.Context, msg string) {
	c.AbortWithStatusJSON(http.StatusBadRequest, body{Error: payload{Code: "VALIDATION", Message: msg}})
}

func classify(err error) (int, payload) {
	var verr *repos.ValidationError
	if errors.As(err, &verr) {
		return http.StatusBadRequest, payload{Code: "VALIDATION", Message: verr.Message, Field: verr.Field}
	}
	switch {
	case errors.Is(err, repos.ErrNotFound):
		return http.StatusNotFound, payload{Code: "NOT_FOUND", Message: "Tracked repository not found"}
	case errors.Is(err, repos.ErrDuplicate):
		return http.StatusConflict, payload{Code: "DUPLICATE", Message: "Repository already tracked"}
	case errors.Is(err, repos.ErrGitHubNotFound):
		return http.StatusNotFound, payload{Code: "GITHUB_NOT_FOUND", Message: "GitHub repository not found"}
	case errors.Is(err, repos.ErrGitHubRateLimited):
		return http.StatusTooManyRequests, payload{Code: "GITHUB_RATE_LIMITED", Message: "GitHub API rate limit reached"}
	case errors.Is(err, repos.ErrUpstream):
		return http.StatusBadGateway, payload{Code: "UPSTREAM", Message: "GitHub upstream failure"}
	}
	return http.StatusInternalServerError, payload{Code: "INTERNAL", Message: "Internal server error"}
}