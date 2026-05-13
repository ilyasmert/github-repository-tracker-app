"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { refreshRepo } from "@/lib/api/repos";
import type { TrackedRepo } from "@/lib/api/types";

import { queryKeys } from "./queryKeys";

export function useRefreshRepo() {
  const qc = useQueryClient();
  return useMutation<TrackedRepo, Error, number>({
    mutationFn: (id) => refreshRepo(id),
    onSuccess: (data) => {
      qc.setQueryData(queryKeys.repo(data.id), data);
      void qc.invalidateQueries({ queryKey: ["repos"] });
      void qc.invalidateQueries({ queryKey: queryKeys.stats() });
    },
  });
}