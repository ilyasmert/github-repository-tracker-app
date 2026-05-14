package handlers

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/ilyas/repository-tracker-app/backend/ent"
	"github.com/ilyas/repository-tracker-app/backend/internal/httpapi/apierror"
	"github.com/ilyas/repository-tracker-app/backend/internal/httpapi/dto"
	"github.com/ilyas/repository-tracker-app/backend/internal/repos"
)

// repoService is the slice of *repos.Service the handlers consume. Declared
// here so tests can substitute a fake without spinning up Ent.
type repoService interface {
	Create(ctx context.Context, owner, name string) (*ent.TrackedRepo, error)
	List(ctx context.Context, filter repos.ListFilter) ([]*ent.TrackedRepo, error)
	Get(ctx context.Context, id int) (*ent.TrackedRepo, error)
	UpdateNotes(ctx context.Context, id int, notes string) (*ent.TrackedRepo, error)
	Delete(ctx context.Context, id int) error
	Refresh(ctx context.Context, id int) (*ent.TrackedRepo, error)
	Stats(ctx context.Context) (repos.Stats, error)
}

type Repos struct {
	svc repoService
}

func NewRepos(svc repoService) *Repos {
	return &Repos{svc: svc}
}

// Register wires all tracked-repo endpoints onto the given /api group.
func (h *Repos) Register(api *gin.RouterGroup) {
	g := api.Group("/repos")
	g.POST("", h.Create)
	g.GET("", h.List)
	g.GET("/stats", h.Stats)
	g.GET("/:id", h.Get)
	g.PATCH("/:id", h.UpdateNotes)
	g.DELETE("/:id", h.Delete)
	g.POST("/:id/refresh", h.Refresh)
}

func (h *Repos) Create(c *gin.Context) {
	var req dto.CreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierror.Validation(c, "invalid JSON body")
		return
	}
	tr, err := h.svc.Create(c.Request.Context(), req.Owner, req.Name)
	if err != nil {
		apierror.Render(c, err)
		return
	}
	c.JSON(http.StatusCreated, dto.FromEnt(tr))
}

func (h *Repos) List(c *gin.Context) {
	sort, ok := parseSort(c.Query("sort"))
	if !ok {
		apierror.Validation(c, "sort must be one of: created_desc, stars_desc, stars_asc")
		return
	}
	var minStars int
	if raw := c.Query("min_stars"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 0 {
			apierror.Validation(c, "min stars cannot be a negative number")
			return
		}
		minStars = n
	}
	rows, err := h.svc.List(c.Request.Context(), repos.ListFilter{
		Language: strings.TrimSpace(c.Query("language")),
		MinStars: minStars,
		Sort:     sort,
	})
	if err != nil {
		apierror.Render(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.FromEntList(rows))
}

func (h *Repos) Get(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	tr, err := h.svc.Get(c.Request.Context(), id)
	if err != nil {
		apierror.Render(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.FromEnt(tr))
}

func (h *Repos) UpdateNotes(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	var req dto.UpdateNotesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apierror.Validation(c, "invalid JSON body")
		return
	}
	if req.Notes == nil {
		apierror.Validation(c, "notes is required")
		return
	}
	tr, err := h.svc.UpdateNotes(c.Request.Context(), id, *req.Notes)
	if err != nil {
		apierror.Render(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.FromEnt(tr))
}

func (h *Repos) Delete(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		apierror.Render(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Repos) Refresh(c *gin.Context) {
	id, ok := parseID(c)
	if !ok {
		return
	}
	tr, err := h.svc.Refresh(c.Request.Context(), id)
	if err != nil {
		apierror.Render(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.FromEnt(tr))
}

func (h *Repos) Stats(c *gin.Context) {
	s, err := h.svc.Stats(c.Request.Context())
	if err != nil {
		apierror.Render(c, err)
		return
	}
	c.JSON(http.StatusOK, dto.StatsFrom(s))
}

func parseID(c *gin.Context) (int, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		apierror.Validation(c, "id must be a positive integer")
		return 0, false
	}
	return id, true
}

func parseSort(raw string) (repos.Sort, bool) {
	switch raw {
	case "", "created_desc":
		return repos.SortCreatedDesc, true
	case "stars_desc":
		return repos.SortStarsDesc, true
	case "stars_asc":
		return repos.SortStarsAsc, true
	}
	return 0, false
}