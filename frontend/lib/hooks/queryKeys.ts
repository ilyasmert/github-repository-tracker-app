import type { ListReposParams } from "@/lib/api/types";

export const queryKeys = {
  repos: (params: ListReposParams = {}) => ["repos", params] as const,
  repo: (id: number) => ["repo", id] as const,
  stats: () => ["stats"] as const,
};