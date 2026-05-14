package dto

import (
	"time"

	"github.com/ilyas/repository-tracker-app/backend/ent"
	"github.com/ilyas/repository-tracker-app/backend/internal/repos"
)

// Repo is the response shape for a single tracked repo. Decoupled from the
// Ent entity so internal storage changes don't leak into the API.
type Repo struct {
	ID          int       `json:"id"`
	Owner       string    `json:"owner"`
	Name        string    `json:"name"`
	FullName    string    `json:"full_name"`
	Description string    `json:"description"`
	Stars       int       `json:"stars"`
	Forks		int		  `json:"forks"`
	Language    string    `json:"language"`
	HTMLURL     string    `json:"html_url"`
	Notes       string    `json:"notes"`
	FetchedAt   time.Time `json:"fetched_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CreateRequest is the body for POST /api/repos.
type CreateRequest struct {
	Owner string `json:"owner"`
	Name  string `json:"name"`
}

// UpdateNotesRequest is the body for PATCH /api/repos/:id. Notes is a pointer
// to distinguish a missing field from an explicit empty string.
type UpdateNotesRequest struct {
	Notes *string `json:"notes"`
}

// Stats is the response shape for GET /api/repos/stats.
type Stats struct {
	Total       int     `json:"total"`
	TotalStars  int     `json:"total_stars"`
	TopLanguage *string `json:"top_language"`
}

// FromEnt maps a stored TrackedRepo into the API DTO.
func FromEnt(t *ent.TrackedRepo) Repo {
	return Repo{
		ID:          t.ID,
		Owner:       t.Owner,
		Name:        t.Name,
		FullName:    t.FullName,
		Description: t.Description,
		Stars:       t.Stars,
		Forks:		 t.Forks,
		Language:    t.Language,
		HTMLURL:     t.HTMLURL,
		Notes:       t.Notes,
		FetchedAt:   t.FetchedAt.UTC(),
		CreatedAt:   t.CreatedAt.UTC(),
		UpdatedAt:   t.UpdatedAt.UTC(),
	}
}

// FromEntList maps a slice of stored entities into DTOs, preserving order and
// returning a non-nil empty slice so JSON encodes as [] not null.
func FromEntList(rows []*ent.TrackedRepo) []Repo {
	out := make([]Repo, 0, len(rows))
	for _, r := range rows {
		out = append(out, FromEnt(r))
	}
	return out
}

// StatsFrom maps the service-layer aggregate into the API DTO.
func StatsFrom(s repos.Stats) Stats {
	return Stats{
		Total:       s.Total,
		TotalStars:  s.TotalStars,
		TopLanguage: s.TopLanguage,
	}
}