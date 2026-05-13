package repos

import (
	"context"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"github.com/ilyas/repository-tracker-app/backend/ent/enttest"
)

// newTestRepo spins up an in-memory SQLite-backed Ent client and returns a
// Repository wired to it. The client is closed via t.Cleanup.
func newTestRepo(t *testing.T) *Repository {
	t.Helper()
	client := enttest.Open(t, "sqlite3", "file:ent?mode=memory&cache=shared&_fk=1")
	t.Cleanup(func() { _ = client.Close() })
	return NewRepository(client)
}

// seed inserts a tracked repo using CreateParams so the test reads like the
// production path. Returns the inserted ID.
func seed(t *testing.T, r *Repository, fullName, language string, stars int) {
	t.Helper()
	owner, name := splitFullName(t, fullName)
	if _, err := r.Create(context.Background(), CreateParams{
		Owner:     owner,
		Name:      name,
		FullName:  fullName,
		Stars:     stars,
		Language:  language,
		HTMLURL:   "https://github.com/" + fullName,
		FetchedAt: time.Date(2026, 5, 14, 0, 0, 0, 0, time.UTC),
	}); err != nil {
		t.Fatalf("seed %q: %v", fullName, err)
	}
}

func splitFullName(t *testing.T, fullName string) (string, string) {
	t.Helper()
	for i := 0; i < len(fullName); i++ {
		if fullName[i] == '/' {
			return fullName[:i], fullName[i+1:]
		}
	}
	t.Fatalf("bad full_name: %q", fullName)
	return "", ""
}

func TestStats_EmptyTable(t *testing.T) {
	r := newTestRepo(t)
	got, err := r.Stats(context.Background())
	if err != nil {
		t.Fatalf("Stats: %v", err)
	}
	if got.Total != 0 || got.TotalStars != 0 || got.TopLanguage != nil {
		t.Errorf("empty table: got %+v", got)
	}
}

func TestStats_AggregatesAndTopLanguage(t *testing.T) {
	r := newTestRepo(t)
	// Two Go repos, one TypeScript repo, one with no language.
	seed(t, r, "golang/go", "Go", 100)
	seed(t, r, "gin-gonic/gin", "Go", 50)
	seed(t, r, "microsoft/typescript", "TypeScript", 80)
	seed(t, r, "owner/no-lang", "", 5)

	got, err := r.Stats(context.Background())
	if err != nil {
		t.Fatalf("Stats: %v", err)
	}
	if got.Total != 4 {
		t.Errorf("Total: got %d want 4", got.Total)
	}
	if got.TotalStars != 235 {
		t.Errorf("TotalStars: got %d want 235", got.TotalStars)
	}
	if got.TopLanguage == nil || *got.TopLanguage != "Go" {
		t.Errorf("TopLanguage: got %v want Go", got.TopLanguage)
	}
}

// When two languages tie on count, topLanguage breaks ties alphabetically so
// the result stays deterministic across calls.
func TestStats_TopLanguageTieBreaksAlphabetically(t *testing.T) {
	r := newTestRepo(t)
	seed(t, r, "a/one", "TypeScript", 10)
	seed(t, r, "b/two", "Go", 10)

	got, err := r.Stats(context.Background())
	if err != nil {
		t.Fatalf("Stats: %v", err)
	}
	if got.TopLanguage == nil || *got.TopLanguage != "Go" {
		t.Errorf("tie-break: got %v want Go", got.TopLanguage)
	}
}

func TestStats_NoLanguagesReturnsNil(t *testing.T) {
	r := newTestRepo(t)
	seed(t, r, "owner/a", "", 7)
	seed(t, r, "owner/b", "", 3)

	got, err := r.Stats(context.Background())
	if err != nil {
		t.Fatalf("Stats: %v", err)
	}
	if got.Total != 2 || got.TotalStars != 10 {
		t.Errorf("totals: got %+v", got)
	}
	if got.TopLanguage != nil {
		t.Errorf("TopLanguage: want nil, got %q", *got.TopLanguage)
	}
}