package github

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	defaultBaseURL = "https://api.github.com"
	defaultTimeout = 10 * time.Second
	userAgent      = "repository-tracker-app"
)

// Repo is the normalized view of a GitHub repository used across the app.
// Deliberately decoupled from the raw API payload.
type Repo struct {
	Owner       string
	Name        string
	FullName    string
	Description string
	HTMLURL     string
	Language    string
	Stars       int
	FetchedAt   time.Time
}

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

// NewClient builds a client against baseURL. Pass an empty token for
// unauthenticated requests (subject to GitHub's anonymous rate limit).
// An empty baseURL falls back to https://api.github.com.
func NewClient(baseURL, token string) *Client {
	if baseURL == "" {
		baseURL = defaultBaseURL
	}
	return &Client{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   token,
		http:    &http.Client{Timeout: defaultTimeout},
	}
}

// repoResponse mirrors the subset of api.github.com/repos/{owner}/{repo}
// we actually consume.
type repoResponse struct {
	Name        string `json:"name"`
	FullName    string `json:"full_name"`
	Description string `json:"description"`
	HTMLURL     string `json:"html_url"`
	Language    string `json:"language"`
	Stars       int    `json:"stargazers_count"`
	Owner       struct {
		Login string `json:"login"`
	} `json:"owner"`
}

// GetRepo fetches a single repository. Returns:
//   - ErrNotFound on 404
//   - ErrRateLimited on 429, or 403 with X-RateLimit-Remaining: 0
//   - ErrUpstream on transport failures, non-success statuses, or decode errors
func (c *Client) GetRepo(ctx context.Context, owner, name string) (*Repo, error) {
	if owner == "" || name == "" {
		return nil, fmt.Errorf("github: owner and name are required")
	}

	endpoint := fmt.Sprintf("%s/repos/%s/%s", c.baseURL, url.PathEscape(owner), url.PathEscape(name))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: build request: %v", ErrUpstream, err)
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", userAgent)
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	res, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrUpstream, err)
	}
	defer res.Body.Close()

	switch res.StatusCode {
	case http.StatusOK:
		// fall through to decode
	case http.StatusNotFound:
		return nil, ErrNotFound
	case http.StatusTooManyRequests:
		return nil, ErrRateLimited
	case http.StatusForbidden:
		if res.Header.Get("X-RateLimit-Remaining") == "0" {
			return nil, ErrRateLimited
		}
		return nil, fmt.Errorf("%w: status %d", ErrUpstream, res.StatusCode)
	default:
		return nil, fmt.Errorf("%w: status %d", ErrUpstream, res.StatusCode)
	}

	// Cap body read so a malformed/huge payload can't OOM us.
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("%w: read body: %v", ErrUpstream, err)
	}

	var parsed repoResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("%w: decode body: %v", ErrUpstream, err)
	}

	return &Repo{
		Owner:       parsed.Owner.Login,
		Name:        parsed.Name,
		FullName:    parsed.FullName,
		Description: parsed.Description,
		HTMLURL:     parsed.HTMLURL,
		Language:    parsed.Language,
		Stars:       parsed.Stars,
		FetchedAt:   time.Now().UTC(),
	}, nil
}