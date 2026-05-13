import { apiFetch } from "./client";
import type {
  CreateRepoBody,
  ListReposParams,
  RepoStats,
  TrackedRepo,
  UpdateRepoBody,
} from "./types";

function buildReposQuery(params: ListReposParams): string {
  const search = new URLSearchParams();
  if (params.language) search.set("language", params.language);
  if (params.sort) search.set("sort", params.sort);
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listRepos(params: ListReposParams = {}): Promise<TrackedRepo[]> {
  return apiFetch<TrackedRepo[]>(`/api/repos${buildReposQuery(params)}`);
}

export function getRepo(id: number): Promise<TrackedRepo> {
  return apiFetch<TrackedRepo>(`/api/repos/${id}`);
}

export function createRepo(body: CreateRepoBody): Promise<TrackedRepo> {
  return apiFetch<TrackedRepo>("/api/repos", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateRepoNotes(
  id: number,
  body: UpdateRepoBody,
): Promise<TrackedRepo> {
  return apiFetch<TrackedRepo>(`/api/repos/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteRepo(id: number): Promise<void> {
  return apiFetch<void>(`/api/repos/${id}`, { method: "DELETE" });
}

export function refreshRepo(id: number): Promise<TrackedRepo> {
  return apiFetch<TrackedRepo>(`/api/repos/${id}/refresh`, { method: "POST" });
}

export function getStats(): Promise<RepoStats> {
  return apiFetch<RepoStats>("/api/repos/stats");
}