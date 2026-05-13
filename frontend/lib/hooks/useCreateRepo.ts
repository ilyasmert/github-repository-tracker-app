"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createRepo } from "@/lib/api/repos";
import type { CreateRepoBody, TrackedRepo } from "@/lib/api/types";

import { queryKeys } from "./queryKeys";

export function useCreateRepo() {
  const qc = useQueryClient();
  return useMutation<TrackedRepo, Error, CreateRepoBody>({
    mutationFn: (body) => createRepo(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["repos"] });
      void qc.invalidateQueries({ queryKey: queryKeys.stats() });
    },
  });
}