package github

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newTestClient(t *testing.T, handler http.HandlerFunc) *Client {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return NewClient(srv.URL, "test-token")
}

func TestGetRepo_Success(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer test-token" {
			t.Errorf("missing/wrong Authorization header: %q", got)
		}
		if got := r.Header.Get("Accept"); got != "application/vnd.github+json" {
			t.Errorf("wrong Accept header: %q", got)
		}
		if r.URL.Path != "/repos/golang/go" {
			t.Errorf("unexpected path: %q", r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"name": "go",
			"full_name": "golang/go",
			"description": "The Go programming language",
			"html_url": "https://github.com/golang/go",
			"language": "Go",
			"stargazers_count": 123456,
			"owner": {"login": "golang"}
		}`))
	})

	repo, err := c.GetRepo(context.Background(), "golang", "go")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.FullName != "golang/go" || repo.Owner != "golang" || repo.Stars != 123456 || repo.Language != "Go" {
		t.Errorf("unexpected repo: %+v", repo)
	}
	if repo.FetchedAt.IsZero() {
		t.Error("FetchedAt should be set")
	}
}

func TestGetRepo_NoTokenOmitsAuthHeader(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" {
			t.Errorf("expected no Authorization header, got %q", r.Header.Get("Authorization"))
		}
		_, _ = w.Write([]byte(`{"name":"go","full_name":"golang/go","owner":{"login":"golang"}}`))
	}))
	defer srv.Close()

	c := NewClient(srv.URL, "")
	if _, err := c.GetRepo(context.Background(), "golang", "go"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestGetRepo_NotFound(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"message":"Not Found"}`, http.StatusNotFound)
	})

	_, err := c.GetRepo(context.Background(), "no", "such")
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestGetRepo_RateLimited_403(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-RateLimit-Remaining", "0")
		http.Error(w, `{"message":"API rate limit exceeded"}`, http.StatusForbidden)
	})

	_, err := c.GetRepo(context.Background(), "golang", "go")
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("expected ErrRateLimited, got %v", err)
	}
}

func TestGetRepo_RateLimited_429(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"message":"Too Many Requests"}`, http.StatusTooManyRequests)
	})

	_, err := c.GetRepo(context.Background(), "golang", "go")
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("expected ErrRateLimited, got %v", err)
	}
}

func TestGetRepo_Forbidden_NotRateLimit_IsUpstream(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		// No X-RateLimit-Remaining header — generic 403.
		http.Error(w, `{"message":"Forbidden"}`, http.StatusForbidden)
	})

	_, err := c.GetRepo(context.Background(), "golang", "go")
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("expected ErrUpstream, got %v", err)
	}
	if errors.Is(err, ErrRateLimited) {
		t.Fatalf("did not expect ErrRateLimited, got %v", err)
	}
}

func TestGetRepo_500_IsUpstream(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, `{"message":"boom"}`, http.StatusInternalServerError)
	})

	_, err := c.GetRepo(context.Background(), "golang", "go")
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("expected ErrUpstream, got %v", err)
	}
}

func TestGetRepo_MalformedJSON_IsUpstream(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`not-json`))
	})

	_, err := c.GetRepo(context.Background(), "golang", "go")
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("expected ErrUpstream, got %v", err)
	}
}

func TestGetRepo_TransportError_IsUpstream(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	srv.Close() // immediately close so dial fails

	c := NewClient(srv.URL, "")
	_, err := c.GetRepo(context.Background(), "golang", "go")
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("expected ErrUpstream, got %v", err)
	}
}

func TestGetRepo_ContextCanceled(t *testing.T) {
	c := newTestClient(t, func(w http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	})

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := c.GetRepo(ctx, "golang", "go")
	if err == nil {
		t.Fatal("expected error from canceled context")
	}
}

func TestGetRepo_EmptyArgs(t *testing.T) {
	c := NewClient("", "")
	if _, err := c.GetRepo(context.Background(), "", "go"); err == nil {
		t.Error("expected error for empty owner")
	}
	if _, err := c.GetRepo(context.Background(), "golang", ""); err == nil {
		t.Error("expected error for empty name")
	}
}