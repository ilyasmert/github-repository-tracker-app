"use client";

import { useQuery } from "@tanstack/react-query";

import { getStats } from "@/lib/api/repos";
import type { RepoStats } from "@/lib/api/types";

import { queryKeys } from "./queryKeys";

export function useStats() {
  return useQuery<RepoStats>({
    queryKey: queryKeys.stats(),
    queryFn: () => getStats(),
  });
}