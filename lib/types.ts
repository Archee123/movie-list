export type Profile = "Archie" | "Susu";
export type Movie = {
  id: string;
  title: string;
  year: string;
  poster: string | null;
  rating: string | null;
  imdbId: string | null;
  overview: string;
  addedBy: Profile;
  addedAt: string;
  watched: boolean;
  watchedBy: Profile | null;
  watchedAt: string | null;
  deleted?: boolean;
};
export type SearchMovie = Pick<
  Movie,
  "id" | "title" | "year" | "poster" | "overview"
>;
