import { profile, json } from "@/lib/auth";
import { tmdb, mapMovie, catalogReady } from "@/lib/catalog";
export async function GET(req: Request) {
  if (!(await profile())) return json({ error: "Please unlock Frame." }, 401);
  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2 || q.length > 100) return json({ results: [] });
  if (!catalogReady())
    return json(
      {
        error:
          "Movie search is being connected. For now, add your film by title.",
        setup: true,
      },
      503,
    );
  try {
    const d = await tmdb(
      "search/multi?include_adult=false&query=" + encodeURIComponent(q),
    );
    return json({
      results: d.results
        .filter(
          (m: { media_type: string }) =>
            m.media_type === "movie" || m.media_type === "tv",
        )
        .slice(0, 12)
        .map(mapMovie),
    });
  } catch {
    return json(
      { error: "Movie search is unavailable. Please try again." },
      502,
    );
  }
}
