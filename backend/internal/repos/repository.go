package repos

import (
	"context"
	"fmt"
	"sort"
	"time"

	"entgo.io/ent/dialect/sql"
	"github.com/ilyas/repository-tracker-app/backend/ent"
	"github.com/ilyas/repository-tracker-app/backend/ent/trackedrepo"
)

// Sort enumerates the orderings supported by List. Defined here so the
// transport layer can parse query params into a typed value without leaking
// Ent into handlers.
type Sort int

const (
	SortCreatedDesc Sort = iota
	SortStarsDesc
	SortStarsAsc
)

// CreateParams is the persistence-facing payload for Create. It mirrors the
// fields the service has after fetching from GitHub but stays free of any
// GitHub or HTTP types.
type CreateParams struct {
	Owner       string
	Name        string
	FullName    string
	Description string
	Stars       int
	Language    string
	HTMLURL     string
	FetchedAt   time.Time
}

// RefreshParams holds the mutable subset updated on Refresh. Identity fields
// (owner, name, full_name) are intentionally excluded.
type RefreshParams struct {
	Description string
	Stars       int
	Language    string
	HTMLURL     string
	FetchedAt   time.Time
}

// ListFilter is the request shape for List. Zero values mean "no filter".
type ListFilter struct {
	Language string
	Sort     Sort
}

// Stats is the result of the aggregation query. TopLanguage is nil when no
// row has a non-empty language.
type Stats struct {
	Total       int
	TotalStars  int
	TopLanguage *string
}

// Repository is the data-access layer for tracked repos. It is the only place
// in the codebase that talks to Ent.
type Repository struct {
	client *ent.Client
}

func NewRepository(client *ent.Client) *Repository {
	return &Repository{client: client}
}

// Create inserts a new tracked repo. Returns ErrDuplicate when full_name is
// already present.
func (r *Repository) Create(ctx context.Context, p CreateParams) (*ent.TrackedRepo, error) {
	tr, err := r.client.TrackedRepo.Create().
		SetOwner(p.Owner).
		SetName(p.Name).
		SetFullName(p.FullName).
		SetDescription(p.Description).
		SetStars(p.Stars).
		SetLanguage(p.Language).
		SetHTMLURL(p.HTMLURL).
		SetFetchedAt(p.FetchedAt).
		Save(ctx)
	if err != nil {
		if ent.IsConstraintError(err) {
			return nil, ErrDuplicate
		}
		return nil, fmt.Errorf("repos: create: %w", err)
	}
	return tr, nil
}

// GetByID returns a single tracked repo by primary key, or ErrNotFound.
func (r *Repository) GetByID(ctx context.Context, id int) (*ent.TrackedRepo, error) {
	tr, err := r.client.TrackedRepo.Get(ctx, id)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("repos: get by id: %w", err)
	}
	return tr, nil
}

// GetByFullName looks up a tracked repo by its "owner/name" key.
func (r *Repository) GetByFullName(ctx context.Context, fullName string) (*ent.TrackedRepo, error) {
	tr, err := r.client.TrackedRepo.Query().
		Where(trackedrepo.FullNameEQ(fullName)).
		Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("repos: get by full_name: %w", err)
	}
	return tr, nil
}

// Exists reports whether a row with the given full_name is already stored.
func (r *Repository) Exists(ctx context.Context, fullName string) (bool, error) {
	ok, err := r.client.TrackedRepo.Query().
		Where(trackedrepo.FullNameEQ(fullName)).
		Exist(ctx)
	if err != nil {
		return false, fmt.Errorf("repos: exists: %w", err)
	}
	return ok, nil
}

// List returns tracked repos matching the filter, ordered per filter.Sort.
func (r *Repository) List(ctx context.Context, filter ListFilter) ([]*ent.TrackedRepo, error) {
	q := r.client.TrackedRepo.Query()
	if filter.Language != "" {
		q = q.Where(trackedrepo.LanguageEqualFold(filter.Language))
	}
	switch filter.Sort {
	case SortStarsDesc:
		q = q.Order(trackedrepo.ByStars(sql.OrderDesc()), trackedrepo.ByID())
	case SortStarsAsc:
		q = q.Order(trackedrepo.ByStars(), trackedrepo.ByID())
	default:
		q = q.Order(trackedrepo.ByCreatedAt(sql.OrderDesc()), trackedrepo.ByID(sql.OrderDesc()))
	}
	rows, err := q.All(ctx)
	if err != nil {
		return nil, fmt.Errorf("repos: list: %w", err)
	}
	return rows, nil
}

// UpdateNotes overwrites only the notes field for the given id.
func (r *Repository) UpdateNotes(ctx context.Context, id int, notes string) (*ent.TrackedRepo, error) {
	tr, err := r.client.TrackedRepo.UpdateOneID(id).
		SetNotes(notes).
		Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("repos: update notes: %w", err)
	}
	return tr, nil
}

// Delete removes the row with the given id. Returns ErrNotFound when missing.
func (r *Repository) Delete(ctx context.Context, id int) error {
	if err := r.client.TrackedRepo.DeleteOneID(id).Exec(ctx); err != nil {
		if ent.IsNotFound(err) {
			return ErrNotFound
		}
		return fmt.Errorf("repos: delete: %w", err)
	}
	return nil
}

// Refresh writes the mutable fields after a GitHub re-fetch.
func (r *Repository) Refresh(ctx context.Context, id int, p RefreshParams) (*ent.TrackedRepo, error) {
	tr, err := r.client.TrackedRepo.UpdateOneID(id).
		SetDescription(p.Description).
		SetStars(p.Stars).
		SetLanguage(p.Language).
		SetHTMLURL(p.HTMLURL).
		SetFetchedAt(p.FetchedAt).
		Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("repos: refresh: %w", err)
	}
	return tr, nil
}

// Stats computes the dashboard aggregates: total rows, summed stars, and the
// language with the most rows (nil if no row has a non-empty language).
func (r *Repository) Stats(ctx context.Context) (Stats, error) {
	total, err := r.client.TrackedRepo.Query().Count(ctx)
	if err != nil {
		return Stats{}, fmt.Errorf("repos: stats count: %w", err)
	}

	var sumRow []struct {
		Sum int `json:"sum"`
	}
	if err := r.client.TrackedRepo.Query().
		Aggregate(ent.Sum(trackedrepo.FieldStars)).
		Scan(ctx, &sumRow); err != nil {
		return Stats{}, fmt.Errorf("repos: stats sum: %w", err)
	}
	var totalStars int
	if len(sumRow) > 0 {
		totalStars = sumRow[0].Sum
	}

	top, err := r.topLanguage(ctx)
	if err != nil {
		return Stats{}, err
	}

	return Stats{Total: total, TotalStars: totalStars, TopLanguage: top}, nil
}

func (r *Repository) topLanguage(ctx context.Context) (*string, error) {
	var rows []struct {
		Language string `json:"language"`
		Count    int    `json:"count"`
	}
	err := r.client.TrackedRepo.Query().
		Where(trackedrepo.LanguageNEQ("")).
		GroupBy(trackedrepo.FieldLanguage).
		Aggregate(ent.As(ent.Count(), "count")).
		Scan(ctx, &rows)
	if err != nil {
		return nil, fmt.Errorf("repos: stats top language: %w", err)
	}
	if len(rows) == 0 {
		return nil, nil
	}
	// Stable tie-break by language name keeps the result deterministic.
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Count != rows[j].Count {
			return rows[i].Count > rows[j].Count
		}
		return rows[i].Language < rows[j].Language
	})
	top := rows[0].Language
	return &top, nil
}