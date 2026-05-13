package config

import (
	"errors"
	"os"
)

type Config struct {
	Port          string
	DatabaseURL   string
	GitHubToken   string
	GitHubBaseURL string
	CORSOrigin    string
}

func Load() (Config, error) {
	cfg := Config{
		Port:          getenv("PORT", "8080"),
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		GitHubToken:   os.Getenv("GITHUB_TOKEN"),
		GitHubBaseURL: getenv("GITHUB_BASE_URL", "https://api.github.com"),
		CORSOrigin:    getenv("CORS_ORIGIN", "http://localhost:3000"),
	}
	if cfg.DatabaseURL == "" {
		return cfg, errors.New("DATABASE_URL is required")
	}
	return cfg, nil
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}