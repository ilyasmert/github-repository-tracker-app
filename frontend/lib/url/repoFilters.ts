import type { ListReposParams, SortOption } from "@/lib/api/types";

const SORT_VALUES: readonly SortOption[] = [
  "stars_desc",
  "stars_asc",
  "created_desc",
];

function isSortOption(value: string): value is SortOption {
  return (SORT_VALUES as readonly string[]).includes(value);
}

export function parseRepoFilters(
  params: URLSearchParams | ReadonlyURLSearchParamsLike,
): ListReposParams {
  const language = params.get("language")?.trim();
  const sortRaw = params.get("sort")?.trim();
  const sort = sortRaw && isSortOption(sortRaw) ? sortRaw : undefined;
  const minStarsRaw = params.get("min_stars")?.trim();
  const minStars = minStarsRaw ? parseInt(minStarsRaw, 10) : undefined;
  return {
    ...(language ? { language } : {}),
    ...(minStars && minStars > 0 ? { minStars } : {}),
    ...(sort ? { sort } : {}),
  };
}

type ReadonlyURLSearchParamsLike = {
  get(key: string): string | null;
};