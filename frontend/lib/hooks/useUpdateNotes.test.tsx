import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { TrackedRepo } from "@/lib/api/types";
import { queryKeys } from "./queryKeys";
import { useUpdateNotes } from "./useUpdateNotes";

vi.mock("@/lib/api/repos", () => ({
  updateRepoNotes: vi.fn(),
}));

import { updateRepoNotes } from "@/lib/api/repos";

const mockedUpdate = vi.mocked(updateRepoNotes);

function makeRepo(overrides: Partial<TrackedRepo> = {}): TrackedRepo {
  return {
    id: 1,
    owner: "golang",
    name: "go",
    full_name: "golang/go",
    description: "",
    stars: 0,
    language: "Go",
    html_url: "https://github.com/golang/go",
    notes: "original",
    fetched_at: "2026-05-14T00:00:00Z",
    created_at: "2026-05-14T00:00:00Z",
    updated_at: "2026-05-14T00:00:00Z",
    ...overrides,
  };
}

function renderWithClient() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useUpdateNotes(), { wrapper });
  return { qc, result };
}

beforeEach(() => {
  mockedUpdate.mockReset();
});

describe("useUpdateNotes optimistic updates", () => {
  it("optimistically updates list + single caches, then keeps the new value on success", async () => {
    const { qc, result } = renderWithClient();
    const repo = makeRepo({ id: 1, notes: "original" });
    const listKey = queryKeys.repos();
    qc.setQueryData<TrackedRepo[]>(listKey, [repo]);
    qc.setQueryData<TrackedRepo>(queryKeys.repo(1), repo);

    let resolveFn!: (v: TrackedRepo) => void;
    mockedUpdate.mockImplementation(
      () => new Promise<TrackedRepo>((res) => (resolveFn = res)),
    );

    act(() => {
      result.current.mutate({ id: 1, notes: "edited" });
    });

    // Optimistic snapshot is applied before the mutation resolves.
    await waitFor(() => {
      expect(qc.getQueryData<TrackedRepo[]>(listKey)?.[0]?.notes).toBe("edited");
    });
    expect(qc.getQueryData<TrackedRepo>(queryKeys.repo(1))?.notes).toBe("edited");

    act(() => {
      resolveFn(makeRepo({ id: 1, notes: "edited" }));
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(qc.getQueryData<TrackedRepo[]>(listKey)?.[0]?.notes).toBe("edited");
  });

  it("rolls back list + single caches to the previous notes when the request fails", async () => {
    const { qc, result } = renderWithClient();
    const repo = makeRepo({ id: 1, notes: "original" });
    const listKey = queryKeys.repos();
    qc.setQueryData<TrackedRepo[]>(listKey, [repo]);
    qc.setQueryData<TrackedRepo>(queryKeys.repo(1), repo);

    mockedUpdate.mockRejectedValueOnce(new Error("server boom"));

    act(() => {
      result.current.mutate({ id: 1, notes: "edited" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(qc.getQueryData<TrackedRepo[]>(listKey)?.[0]?.notes).toBe("original");
    expect(qc.getQueryData<TrackedRepo>(queryKeys.repo(1))?.notes).toBe("original");
  });

  it("leaves other rows untouched during rollback", async () => {
    const { qc, result } = renderWithClient();
    const target = makeRepo({ id: 1, notes: "original" });
    const sibling = makeRepo({
      id: 2,
      full_name: "gin-gonic/gin",
      notes: "sibling notes",
    });
    const listKey = queryKeys.repos();
    qc.setQueryData<TrackedRepo[]>(listKey, [target, sibling]);

    mockedUpdate.mockRejectedValueOnce(new Error("boom"));

    act(() => {
      result.current.mutate({ id: 1, notes: "edited" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const list = qc.getQueryData<TrackedRepo[]>(listKey) ?? [];
    expect(list.find((r) => r.id === 1)?.notes).toBe("original");
    expect(list.find((r) => r.id === 2)?.notes).toBe("sibling notes");
  });
});