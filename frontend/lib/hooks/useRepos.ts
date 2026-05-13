"use client";

import { useQuery } from "@tanstack/react-query";

import { listRepos } from "@/lib/api/repos";
import type { ListReposParams, TrackedRepo } from "@/lib/api/types";

import { queryKeys } from "./queryKeys";

export function useRepos(params: ListReposParams = {}) {
  return useQuery<TrackedRepo[]>({
    queryKey: queryKeys.repos(params),
    queryFn: () => listRepos(params),
  });
}