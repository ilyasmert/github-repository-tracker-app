export type TrackedRepo = {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  stars: number;
  language: string | null;
  html_url: string;
  notes: string;
  fetched_at: string;
  created_at: string;
  updated_at: string;
};

export type RepoStats = {
  total: number;
  total_stars: number;
  top_language: string | null;
};

export type SortOption = "stars_desc" | "stars_asc" | "created_desc";

export type ListReposParams = {
  language?: string;
  sort?: SortOption;
};

export type CreateRepoBody = {
  owner: string;
  name: string;
};

export type UpdateRepoBody = {
  notes: string;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
  };
};