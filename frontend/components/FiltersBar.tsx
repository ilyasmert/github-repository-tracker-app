"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import type { SortOption } from "@/lib/api/types";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "created_desc", label: "Recently added" },
  { value: "stars_desc", label: "Stars (high → low)" },
  { value: "stars_asc", label: "Stars (low → high)" },
];

export function FiltersBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const languageParam = searchParams.get("language") ?? "";
  const minStarsParam = searchParams.get("min_stars") ?? "";
  const sortParam = (searchParams.get("sort") as SortOption | null) ?? "created_desc";

  const [language, setLanguage] = useState(languageParam);
  const [minStars, setMinStars] = useState(minStarsParam);

  useEffect(() => {
    setLanguage(languageParam);
    setMinStars(minStarsParam);
  }, [languageParam, minStarsParam]);

  const updateParams = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams.toString());
    mutate(next);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const commitLanguage = (value: string) => {
    const trimmed = value.trim();
    updateParams((next) => {
      if (trimmed) next.set("language", trimmed);
      else next.delete("language");
    });
  };

  const commitMinStars = (value: string) => {
    const trimmed = value.trim();
    updateParams((next) => {
      if (trimmed) next.set("min_stars", trimmed);
      else next.delete("min_stars");
    });
  };

  const onSortChange = (value: string) => {
    updateParams((next) => {
      if (value && value !== "created_desc") next.set("sort", value);
      else next.delete("sort");
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col">
        <label htmlFor="language-filter" className="text-xs font-medium text-slate-600">
          Language
        </label>
        <input
          id="language-filter"
          type="text"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          onBlur={(e) => commitLanguage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitLanguage(e.currentTarget.value);
            }
          }}
          placeholder="e.g. Go"
          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:w-48"
        />
      </div>

      <div className="flex flex-col">
        <label htmlFor="min-stars-filter" className="text-xs font-medium text-slate-600">
          Min Stars
        </label>
        <input
          id="min-stars-filter"
          type="number"
          min={0}
          value={minStars}
          onChange={(e) => setMinStars(e.target.value)}
          onBlur={(e) => commitMinStars(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitMinStars(e.currentTarget.value);
            }
          }}
          placeholder="e.g. 1000"
          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:w-48"
        />
      </div>

      <div className="flex flex-col">
        <label htmlFor="sort-select" className="text-xs font-medium text-slate-600">
          Sort
        </label>
        <select
          id="sort-select"
          value={sortParam}
          onChange={(e) => onSortChange(e.target.value)}
          className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 sm:w-56"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}