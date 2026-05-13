"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { deleteRepo } from "@/lib/api/repos";

import { queryKeys } from "./queryKeys";

export function useDeleteRepo() {
  const qc = useQueryClient();
  return useMutation<void, Error, number>({
    mutationFn: (id) => deleteRepo(id),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: queryKeys.repo(id) });
      void qc.invalidateQueries({ queryKey: ["repos"] });
      void qc.invalidateQueries({ queryKey: queryKeys.stats() });
    },
  });
}