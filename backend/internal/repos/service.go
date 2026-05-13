package repos

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/ilyas/repository-tracker-app/backend/ent"
	"github.com/ilyas/repository-tracker-app/backend/internal/github"
)

const (
	maxOwnerNameLen = 100
	maxNotesLen     = 2000
)

// nameSegment matches a single owner or repo segment per GitHub's rules:
// must start with an alphanumeric, followed by alphanumerics, dot, hyphen, or
// underscore.
var nameSegment = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]*$`)

// repoStore is the subset of *Repository used by Service. Declared here (not
// in repository.go) because the service is its only consumer; the interface
// exists to let unit tests substitute a fake without a live Ent client.
type repoStore interface {
	Create(ctx context.Context, p CreateParams) (*ent.TrackedRepo, error)
	GetByID(ctx context.Context, id int) (*ent.TrackedRepo, error)
	Exists(ctx context.Context, fullName string) (bool, error)
	List(ctx context.Context, filter ListFilter) ([]*ent.TrackedRepo, error)
	UpdateNotes(ctx context.Context, id int, notes string) (*ent.TrackedRepo, error)
	Delete(ctx context.Context, id int) error
	Refresh(ctx context.Context, id int, p RefreshParams) (*ent.TrackedRepo, error)
	Stats(ctx context.Context) (Stats, error)
}

// githubFetcher is the slice of the GitHub client the service consumes.
type githubFetcher interface {
	GetRepo(ctx context.Context, owner, name string) (*github.Repo, error)
}

// Service is the orchestration layer for the tracked-repo feature. It is the
// only place that knows "create = fetch + persist" and "refresh = fetch +
// update"; handlers stay thin and the repository stays Ent-only.
type Service struct {
	repo repoStore
	gh   githubFetcher
}

func NewService(repo repoStore, gh githubFetcher) *Service {
	return &Service{repo: repo, gh: gh}
}

// Create validates input, ensures no duplicate, fetches the canonical repo
// from GitHub, and persists it.
func (s *Service) Create(ctx context.Context, owner, name string) (*ent.TrackedRepo, error) {
	owner = strings.TrimSpace(owner)
	name = strings.TrimSpace(name)
	if err := validateSegment("owner", owner); err != nil {
		return nil, err
	}
	if err := validateSegment("name", name); err != nil {
		return nil, err
	}

	fullName := owner + "/" + name
	exists, err := s.repo.Exists(ctx, fullName)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrDuplicate
	}

	gh, err := s.fetchFromGitHub(ctx, owner, name)
	if err != nil {
		return nil, err
	}

	created, err := s.repo.Create(ctx, CreateParams{
		Owner:       gh.Owner,
		Name:        gh.Name,
		FullName:    gh.FullName,
		Description: gh.Description,
		Stars:       gh.Stars,
		Language:    gh.Language,
		HTMLURL:     gh.HTMLURL,
		FetchedAt:   gh.FetchedAt,
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

// Refresh re-fetches the row's GitHub data and updates the mutable fields,
// including fetched_at.
func (s *Service) Refresh(ctx context.Context, id int) (*ent.TrackedRepo, error) {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	gh, err := s.fetchFromGitHub(ctx, existing.Owner, existing.Name)
	if err != nil {
		return nil, err
	}

	updated, err := s.repo.Refresh(ctx, id, RefreshParams{
		Description: gh.Description,
		Stars:       gh.Stars,
		Language:    gh.Language,
		HTMLURL:     gh.HTMLURL,
		FetchedAt:   gh.FetchedAt,
	})
	if err != nil {
		return nil, err
	}
	return updated, nil
}

// List returns tracked repos matching the filter. Pure delegation — kept on
// the service so handlers depend on one type.
func (s *Service) List(ctx context.Context, filter ListFilter) ([]*ent.TrackedRepo, error) {
	return s.repo.List(ctx, filter)
}

// Get returns a single tracked repo by id.
func (s *Service) Get(ctx context.Context, id int) (*ent.TrackedRepo, error) {
	return s.repo.GetByID(ctx, id)
}

// UpdateNotes validates and writes a new notes value.
func (s *Service) UpdateNotes(ctx context.Context, id int, notes string) (*ent.TrackedRepo, error) {
	if len(notes) > maxNotesLen {
		return nil, &ValidationError{Field: "notes", Message: "must be 2000 characters or fewer"}
	}
	return s.repo.UpdateNotes(ctx, id, notes)
}

// Delete removes a tracked repo by id.
func (s *Service) Delete(ctx context.Context, id int) error {
	return s.repo.Delete(ctx, id)
}

// Stats returns dashboard aggregates.
func (s *Service) Stats(ctx context.Context) (Stats, error) {
	return s.repo.Stats(ctx)
}

// fetchFromGitHub centralises the github → domain error translation so the
// HTTP layer only has to know about repos.Err* sentinels.
func (s *Service) fetchFromGitHub(ctx context.Context, owner, name string) (*github.Repo, error) {
	repo, err := s.gh.GetRepo(ctx, owner, name)
	if err == nil {
		return repo, nil
	}
	switch {
	case errors.Is(err, github.ErrNotFound):
		return nil, ErrGitHubNotFound
	case errors.Is(err, github.ErrRateLimited):
		return nil, ErrGitHubRateLimited
	default:
		return nil, ErrUpstream
	}
}

func validateSegment(field, value string) error {
	if value == "" {
		return &ValidationError{Field: field, Message: "must not be empty"}
	}
	if len(value) > maxOwnerNameLen {
		return &ValidationError{Field: field, Message: "must be 100 characters or fewer"}
	}
	if !nameSegment.MatchString(value) {
		return &ValidationError{Field: field, Message: "must start with alphanumeric and contain only letters, digits, '.', '-', or '_'"}
	}
	return nil
}
