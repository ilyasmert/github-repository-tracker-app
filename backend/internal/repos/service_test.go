package repos

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/ilyas/repository-tracker-app/backend/ent"
	"github.com/ilyas/repository-tracker-app/backend/internal/github"
)

type fakeRepo struct {
	existsFn      func(ctx context.Context, fullName string) (bool, error)
	createFn      func(ctx context.Context, p CreateParams) (*ent.TrackedRepo, error)
	getByIDFn     func(ctx context.Context, id int) (*ent.TrackedRepo, error)
	refreshFn     func(ctx context.Context, id int, p RefreshParams) (*ent.TrackedRepo, error)
	updateNotesFn func(ctx context.Context, id int, notes string) (*ent.TrackedRepo, error)
	deleteFn      func(ctx context.Context, id int) error
	listFn        func(ctx context.Context, filter ListFilter) ([]*ent.TrackedRepo, error)
	statsFn       func(ctx context.Context) (Stats, error)

	lastCreateParams  *CreateParams
	lastRefreshParams *RefreshParams
	lastRefreshID     int
}

func (f *fakeRepo) Exists(ctx context.Context, fullName string) (bool, error) {
	return f.existsFn(ctx, fullName)
}
func (f *fakeRepo) Create(ctx context.Context, p CreateParams) (*ent.TrackedRepo, error) {
	f.lastCreateParams = &p
	return f.createFn(ctx, p)
}
func (f *fakeRepo) GetByID(ctx context.Context, id int) (*ent.TrackedRepo, error) {
	return f.getByIDFn(ctx, id)
}
func (f *fakeRepo) Refresh(ctx context.Context, id int, p RefreshParams) (*ent.TrackedRepo, error) {
	f.lastRefreshID = id
	f.lastRefreshParams = &p
	return f.refreshFn(ctx, id, p)
}
func (f *fakeRepo) UpdateNotes(ctx context.Context, id int, notes string) (*ent.TrackedRepo, error) {
	return f.updateNotesFn(ctx, id, notes)
}
func (f *fakeRepo) Delete(ctx context.Context, id int) error {
	return f.deleteFn(ctx, id)
}
func (f *fakeRepo) List(ctx context.Context, filter ListFilter) ([]*ent.TrackedRepo, error) {
	return f.listFn(ctx, filter)
}
func (f *fakeRepo) Stats(ctx context.Context) (Stats, error) {
	return f.statsFn(ctx)
}

type fakeGitHub struct {
	getRepoFn func(ctx context.Context, owner, name string) (*github.Repo, error)
}

func (f *fakeGitHub) GetRepo(ctx context.Context, owner, name string) (*github.Repo, error) {
	return f.getRepoFn(ctx, owner, name)
}

func TestCreate_Success(t *testing.T) {
	fetched := time.Date(2026, 5, 13, 12, 0, 0, 0, time.UTC)
	repo := &fakeRepo{
		existsFn: func(ctx context.Context, fullName string) (bool, error) {
			if fullName != "golang/go" {
				t.Errorf("unexpected full_name: %q", fullName)
			}
			return false, nil
		},
		createFn: func(ctx context.Context, p CreateParams) (*ent.TrackedRepo, error) {
			return &ent.TrackedRepo{ID: 1, FullName: p.FullName, Stars: p.Stars, FetchedAt: p.FetchedAt}, nil
		},
	}
	gh := &fakeGitHub{
		getRepoFn: func(ctx context.Context, owner, name string) (*github.Repo, error) {
			return &github.Repo{
				Owner: "golang", Name: "go", FullName: "golang/go",
				Description: "Go programming language", HTMLURL: "https://github.com/golang/go",
				Language: "Go", Stars: 100000, FetchedAt: fetched,
			}, nil
		},
	}
	s := NewService(repo, gh)

	got, err := s.Create(context.Background(), "golang", "go")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got.FullName != "golang/go" {
		t.Errorf("FullName: got %q", got.FullName)
	}
	if repo.lastCreateParams == nil || !repo.lastCreateParams.FetchedAt.Equal(fetched) {
		t.Errorf("FetchedAt not propagated to Create")
	}
}

func TestCreate_Duplicate(t *testing.T) {
	repo := &fakeRepo{
		existsFn: func(ctx context.Context, fullName string) (bool, error) { return true, nil },
	}
	gh := &fakeGitHub{
		getRepoFn: func(ctx context.Context, owner, name string) (*github.Repo, error) {
			t.Fatal("github should not be called when duplicate")
			return nil, nil
		},
	}
	s := NewService(repo, gh)

	_, err := s.Create(context.Background(), "golang", "go")
	if !errors.Is(err, ErrDuplicate) {
		t.Fatalf("want ErrDuplicate, got %v", err)
	}
}

func TestCreate_GitHubNotFound(t *testing.T) {
	repo := &fakeRepo{
		existsFn: func(ctx context.Context, fullName string) (bool, error) { return false, nil },
	}
	gh := &fakeGitHub{
		getRepoFn: func(ctx context.Context, owner, name string) (*github.Repo, error) {
			return nil, github.ErrNotFound
		},
	}
	s := NewService(repo, gh)

	_, err := s.Create(context.Background(), "noone", "nothing")
	if !errors.Is(err, ErrGitHubNotFound) {
		t.Fatalf("want ErrGitHubNotFound, got %v", err)
	}
}

func TestCreate_GitHubRateLimited(t *testing.T) {
	repo := &fakeRepo{
		existsFn: func(ctx context.Context, fullName string) (bool, error) { return false, nil },
	}
	gh := &fakeGitHub{
		getRepoFn: func(ctx context.Context, owner, name string) (*github.Repo, error) {
			return nil, github.ErrRateLimited
		},
	}
	s := NewService(repo, gh)

	_, err := s.Create(context.Background(), "golang", "go")
	if !errors.Is(err, ErrGitHubRateLimited) {
		t.Fatalf("want ErrGitHubRateLimited, got %v", err)
	}
}

func TestCreate_GitHubUpstream(t *testing.T) {
	repo := &fakeRepo{
		existsFn: func(ctx context.Context, fullName string) (bool, error) { return false, nil },
	}
	gh := &fakeGitHub{
		getRepoFn: func(ctx context.Context, owner, name string) (*github.Repo, error) {
			return nil, github.ErrUpstream
		},
	}
	s := NewService(repo, gh)

	_, err := s.Create(context.Background(), "golang", "go")
	if !errors.Is(err, ErrUpstream) {
		t.Fatalf("want ErrUpstream, got %v", err)
	}
}

func TestCreate_Validation(t *testing.T) {
	s := NewService(&fakeRepo{}, &fakeGitHub{})
	cases := []struct {
		name        string
		owner, repo string
	}{
		{"empty owner", "", "go"},
		{"empty name", "golang", ""},
		{"bad owner char", "gol ang", "go"},
		{"bad name char", "golang", "go!"},
		{"leading dot", "golang", ".go"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := s.Create(context.Background(), tc.owner, tc.repo)
			var ve *ValidationError
			if !errors.As(err, &ve) {
				t.Fatalf("want ValidationError, got %v", err)
			}
		})
	}
}

func TestRefresh_Success(t *testing.T) {
	original := &ent.TrackedRepo{ID: 42, Owner: "golang", Name: "go", FullName: "golang/go"}
	newFetched := time.Date(2026, 5, 13, 18, 0, 0, 0, time.UTC)

	repo := &fakeRepo{
		getByIDFn: func(ctx context.Context, id int) (*ent.TrackedRepo, error) {
			if id != 42 {
				t.Errorf("unexpected id: %d", id)
			}
			return original, nil
		},
		refreshFn: func(ctx context.Context, id int, p RefreshParams) (*ent.TrackedRepo, error) {
			return &ent.TrackedRepo{ID: id, Stars: p.Stars, FetchedAt: p.FetchedAt}, nil
		},
	}
	gh := &fakeGitHub{
		getRepoFn: func(ctx context.Context, owner, name string) (*github.Repo, error) {
			if owner != "golang" || name != "go" {
				t.Errorf("unexpected fetch: %s/%s", owner, name)
			}
			return &github.Repo{Stars: 200000, FetchedAt: newFetched}, nil
		},
	}
	s := NewService(repo, gh)

	got, err := s.Refresh(context.Background(), 42)
	if err != nil {
		t.Fatalf("Refresh: %v", err)
	}
	if !got.FetchedAt.Equal(newFetched) {
		t.Errorf("fetched_at not updated: got %v want %v", got.FetchedAt, newFetched)
	}
	if repo.lastRefreshParams == nil || repo.lastRefreshParams.Stars != 200000 {
		t.Errorf("refresh params not propagated: %+v", repo.lastRefreshParams)
	}
}

func TestRefresh_NotFound(t *testing.T) {
	repo := &fakeRepo{
		getByIDFn: func(ctx context.Context, id int) (*ent.TrackedRepo, error) { return nil, ErrNotFound },
	}
	gh := &fakeGitHub{
		getRepoFn: func(ctx context.Context, owner, name string) (*github.Repo, error) {
			t.Fatal("github should not be called when repo missing")
			return nil, nil
		},
	}
	s := NewService(repo, gh)

	_, err := s.Refresh(context.Background(), 999)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("want ErrNotFound, got %v", err)
	}
}

func TestUpdateNotes_TooLong(t *testing.T) {
	s := NewService(&fakeRepo{}, &fakeGitHub{})
	long := make([]byte, maxNotesLen+1)
	for i := range long {
		long[i] = 'a'
	}
	_, err := s.UpdateNotes(context.Background(), 1, string(long))
	var ve *ValidationError
	if !errors.As(err, &ve) {
		t.Fatalf("want ValidationError, got %v", err)
	}
}

func TestUpdateNotes_Delegates(t *testing.T) {
	called := false
	repo := &fakeRepo{
		updateNotesFn: func(ctx context.Context, id int, notes string) (*ent.TrackedRepo, error) {
			called = true
			if id != 7 || notes != "hello" {
				t.Errorf("bad args: %d %q", id, notes)
			}
			return &ent.TrackedRepo{ID: id, Notes: notes}, nil
		},
	}
	s := NewService(repo, &fakeGitHub{})
	if _, err := s.UpdateNotes(context.Background(), 7, "hello"); err != nil {
		t.Fatalf("UpdateNotes: %v", err)
	}
	if !called {
		t.Fatal("repo.UpdateNotes not called")
	}
}

func TestDelete_Delegates(t *testing.T) {
	repo := &fakeRepo{
		deleteFn: func(ctx context.Context, id int) error {
			if id != 5 {
				t.Errorf("bad id: %d", id)
			}
			return nil
		},
	}
	s := NewService(repo, &fakeGitHub{})
	if err := s.Delete(context.Background(), 5); err != nil {
		t.Fatalf("Delete: %v", err)
	}
}

func TestStats_Delegates(t *testing.T) {
	top := "Go"
	repo := &fakeRepo{
		statsFn: func(ctx context.Context) (Stats, error) {
			return Stats{Total: 3, TotalStars: 42, TopLanguage: &top}, nil
		},
	}
	s := NewService(repo, &fakeGitHub{})
	got, err := s.Stats(context.Background())
	if err != nil {
		t.Fatalf("Stats: %v", err)
	}
	if got.Total != 3 || got.TotalStars != 42 || got.TopLanguage == nil || *got.TopLanguage != "Go" {
		t.Errorf("unexpected stats: %+v", got)
	}
}
