package httpapi

import (
	"net/http"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/ilyas/repository-tracker-app/backend/internal/config"
	"github.com/ilyas/repository-tracker-app/backend/internal/httpapi/handlers"
	"github.com/ilyas/repository-tracker-app/backend/internal/repos"
)

// NewRouter builds the Gin engine and registers every API route. Dependencies
// are injected so cmd/server can wire them and tests can swap them out.
func NewRouter(cfg config.Config, svc *repos.Service) *gin.Engine {
	r := gin.New()
	r.Use(gin.Recovery(), gin.Logger())
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.CORSOrigin},
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		AllowCredentials: false,
	}))

	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	api := r.Group("/api")
	handlers.NewRepos(svc).Register(api)

	return r
}