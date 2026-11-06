"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Movie, Profile, SearchMovie } from "@/lib/types";

async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api/" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const d = await r.json();
  if (!r.ok)
    throw new Error(d.error || "Something went wrong. Please try again.");
  return d;
}
function Brand() {
  return (
    <a className="brand" href="/" aria-label="The Palace Cinema home">
      The Palace Cinema
    </a>
  );
}
function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(
    () => setDark(document.documentElement.dataset.theme === "dark"),
    [],
  );
  function toggle() {
    const next = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = next ? "dark" : "light";
    setDark(next);
    try {
      localStorage.setItem("palace-theme", next ? "dark" : "light");
    } catch {}
  }
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={dark ? "Use light mode" : "Use dark mode"}
      title={dark ? "Use light mode" : "Use dark mode"}
    >
      {dark ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />
        </svg>
      )}
      <span className="theme-label">{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
function Poster({
  movie,
  small = false,
}: {
  movie: SearchMovie;
  small?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  return movie.poster && !broken ? (
    <img
      className={small ? "poster small" : "poster"}
      src={movie.poster}
      alt={movie.title + " poster"}
      loading="lazy"
      onError={() => setBroken(true)}
    />
  ) : (
    <div
      className={"poster poster-fallback" + (small ? " small" : "")}
      aria-label="No poster available"
    >
      <span>{movie.title}</span>
      <span>{movie.year || "A film to remember"}</span>
    </div>
  );
}
function Credits() {
  return (
    <footer>
      <details>
        <summary>Movie data & credits</summary>
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">
          <img className="tmdb-logo" src="/tmdb.svg" alt="TMDB" />
        </a>
        <p>
          This product uses the TMDB API but is not endorsed or certified by
          TMDB. Posters and movie details from TMDB. IMDb ratings supplied by
          the{" "}
          <a href="https://www.omdbapi.com" target="_blank" rel="noreferrer">
            OMDb API
          </a>
          . Ratings may change; unavailable ratings are shown as such.
        </p>
      </details>
    </footer>
  );
}

export default function Frame({
  initialProfile,
}: {
  initialProfile: Profile | null;
}) {
  const [who, setWho] = useState<Profile | null>(initialProfile),
    [choice, setChoice] = useState<Profile>("Archie"),
    [passcode, setPasscode] = useState(""),
    [loginBusy, setLoginBusy] = useState(false),
    [error, setError] = useState("");
  const [movies, setMovies] = useState<Movie[]>([]),
    [loaded, setLoaded] = useState(false),
    [tab, setTab] = useState<"watchlist" | "watched">("watchlist"),
    [filter, setFilter] = useState(""),
    [sort, setSort] = useState("recent"),
    [busy, setBusy] = useState<string | null>(null),
    [notice, setNotice] = useState(""),
    [adding, setAdding] = useState(false),
    [catalog, setCatalog] = useState(true),
    [ratings, setRatings] = useState(true),
    [randomId, setRandomId] = useState<string | null>(null);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [creatingTag, setCreatingTag] = useState(false);
  const [tagBusy, setTagBusy] = useState(false);
  const [managingTags, setManagingTags] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  async function deleteTag(tag: { id: string; name: string }) {
    if (!window.confirm(`Delete “${tag.name}” from all movies and series?`))
      return;
    setTagBusy(true);
    setError("");
    try {
      await api("tags", "DELETE", { id: tag.id });
      setTags((ts) => ts.filter((t) => t.id !== tag.id));
      setSelectedTags((ids) => ids.filter((id) => id !== tag.id));
      setMovies((ms) =>
        ms.map((m) => ({
          ...m,
          tags: (m.tags || []).filter((id) => id !== tag.id),
        })),
      );
      setNotice(`Deleted “${tag.name}”.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTagBusy(false);
    }
  }
  async function addTag(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setTagBusy(true);
    setError("");
    try {
      const d = await api("tags", "POST", { name: newTag });
      setTags((ts) =>
        [...ts.filter((t) => t.id !== d.tag.id), d.tag].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setNewTag("");
      setCreatingTag(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTagBusy(false);
    }
  }
  async function tagMovie(movie: Movie, ids: string[]) {
    setBusy(movie.id);
    setError("");
    try {
      const d = await api("movies/" + movie.id, "PATCH", { tags: ids });
      setMovies((ms) => ms.map((m) => (m.id === movie.id ? d.movie : m)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const dialog = useRef<HTMLDialogElement>(null);
  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    setError("");
    try {
      const [d, t] = await Promise.all([api("movies"), api("tags")]);
      setTags(t.tags);
      setMovies(d.movies);
      setCatalog(d.catalogReady);
      setRatings(d.ratingsReady);
      setLoaded(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, []);
  useEffect(() => {
    if (!who) return;
    void refresh();
  }, [who, refresh]);
  useEffect(() => {
    if (adding) dialog.current?.showModal();
    else dialog.current?.close();
  }, [adding]);
  async function login(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginBusy(true);
    setError("");
    try {
      await api("session", "POST", { profile: choice, passcode });
      setPasscode("");
      setWho(choice);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoginBusy(false);
    }
  }
  async function logout() {
    try {
      await api("session", "DELETE");
      setWho(null);
      setMovies([]);
      setLoaded(false);
      setError("");
      setNotice("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function update(movie: Movie, deleted = false) {
    if (
      deleted &&
      !window.confirm("Remove " + movie.title + " from your shared list?")
    )
      return;
    setBusy(movie.id);
    setError("");
    try {
      const d = await api(
        "movies/" + movie.id,
        "PATCH",
        deleted ? { deleted: true } : { watched: !movie.watched },
      );
      setMovies((ms) =>
        deleted
          ? ms.filter((m) => m.id !== movie.id)
          : ms.map((m) => (m.id === movie.id ? d.movie : m)),
      );
      setNotice(
        deleted
          ? "Movie removed."
          : movie.watched
            ? "Moved back to your watchlist."
            : "Marked as watched. Find it in Watched.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  const unwatched = movies.filter((m) => !m.watched),
    watched = movies.filter((m) => m.watched);
  const visible = movies
    .filter(
      (m) =>
        m.watched === (tab === "watched") &&
        m.title.toLowerCase().includes(filter.toLowerCase()) &&
        selectedTags.every((id) => (m.tags || []).includes(id)),
    )
    .sort((a, b) =>
      sort === "tags"
        ? (a.tags || [])
            .map((id) => tags.find((t) => t.id === id)?.name || "")
            .sort()
            .join(", ")
            .localeCompare(
              (b.tags || [])
                .map((id) => tags.find((t) => t.id === id)?.name || "")
                .sort()
                .join(", "),
            ) || a.title.localeCompare(b.title)
        : sort === "title"
          ? a.title.localeCompare(b.title)
          : sort === "rating"
            ? Number(b.rating || -1) - Number(a.rating || -1)
            : sort === "year"
              ? Number(b.year) - Number(a.year)
              : tab === "watched"
                ? (b.watchedAt || "").localeCompare(a.watchedAt || "")
                : b.addedAt.localeCompare(a.addedAt),
    );
  return (
    <>
      <header>
        <Brand />
        {who ? (
          <>
            <nav aria-label="Movie lists">
              <button
                className={tab === "watchlist" ? "active" : ""}
                onClick={() => {
                  setTab("watchlist");
                  setRandomId(null);
                }}
              >
                Watchlist <span>{unwatched.length}</span>
              </button>
              <button
                className={tab === "watched" ? "active" : ""}
                onClick={() => {
                  setTab("watched");
                  setRandomId(null);
                }}
              >
                Watched <span>{watched.length}</span>
              </button>
            </nav>
          </>
        ) : null}
        <div className="header-actions">
          <ThemeToggle />
          {who ? (
            <button
              className="profile"
              onClick={logout}
              aria-label={"Switch account, currently " + who}
              title="Switch account"
            >
              <span className={"initial " + who.toLowerCase()}>{who[0]}</span>
              <span>{who}</span>
            </button>
          ) : null}
        </div>
      </header>
      {!who ? (
        <main className="welcome">
          <section className="welcome-intro">
            <form
              className="unlock"
              onSubmit={login}
              aria-label="Open movie list"
            >
              <fieldset>
                <legend>Who’s watching?</legend>
                <div className="profile-options">
                  {(["Archie", "Susu"] as Profile[]).map((name) => (
                    <label
                      key={name}
                      className={choice === name ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name="profile"
                        value={name}
                        checked={choice === name}
                        onChange={() => setChoice(name)}
                      />
                      <span className={"initial " + name.toLowerCase()}>
                        {name[0]}
                      </span>
                      {name}
                      <span className="selected-check">
                        {choice === name ? "✓" : ""}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="sr-only" htmlFor="passcode">
                Passcode
              </label>
              <input
                id="passcode"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter passcode"
                required
                maxLength={32}
              />
              {error ? (
                <p className="error" role="alert">
                  {error}
                </p>
              ) : null}
              <button className="primary" disabled={loginBusy}>
                {loginBusy ? "Opening…" : "Open movie list"}
              </button>
            </form>
          </section>
        </main>
      ) : (
        <main className="collection">
          <section
            className="list-section"
            aria-label={
              tab === "watched" ? "Watched movies" : "Movies to watch"
            }
          >
            <div className="list-heading">
              <h1>
                {tab === "watched" ? "Watched together" : "On our watchlist"}{" "}
                <span>
                  {tab === "watched" ? watched.length : unwatched.length}
                </span>
              </h1>
              <div className="list-actions">
                <button
                  className="text-button"
                  onClick={() => void refresh()}
                  disabled={refreshing}
                >
                  {refreshing ? "Refreshing…" : "Refresh"}
                </button>
                {(tab === "watched" ? watched.length : unwatched.length) > 0 ? (
                  <button className="primary" onClick={() => setAdding(true)}>
                    + Add movie
                  </button>
                ) : null}
                {tab === "watchlist" && unwatched.length > 0 ? (
                  <button
                    className="text-button surprise"
                    onClick={() => {
                      const m =
                        unwatched[Math.floor(Math.random() * unwatched.length)];
                      setRandomId(m.id);
                      setFilter("");
                      setNotice("Tonight’s pick: " + m.title);
                      setTimeout(
                        () =>
                          document
                            .getElementById("movie-" + m.id)
                            ?.scrollIntoView({
                              behavior: window.matchMedia(
                                "(prefers-reduced-motion: reduce)",
                              ).matches
                                ? "instant"
                                : "smooth",
                              block: "center",
                            }),
                        30,
                      );
                    }}
                  >
                    Pick for us
                  </button>
                ) : null}
              </div>
            </div>
            <p className="connection-note">
              Your edits appear immediately. Refresh to see changes made on
              another device.
            </p>
            <div className="tag-tabs" aria-label="Filter by tags">
              <button
                aria-pressed={!selectedTags.length}
                onClick={() => setSelectedTags([])}
              >
                All titles
              </button>
              {tags.map((t) => (
                <button
                  key={t.id}
                  aria-pressed={selectedTags.includes(t.id)}
                  onClick={() =>
                    setSelectedTags((ids) =>
                      ids.includes(t.id)
                        ? ids.filter((id) => id !== t.id)
                        : [...ids, t.id],
                    )
                  }
                >
                  {t.name}
                </button>
              ))}
              <button
                onClick={() => setCreatingTag((v) => !v)}
                aria-expanded={creatingTag}
              >
                + New tag
              </button>
              {tags.length ? (
                <button
                  onClick={() => setManagingTags((v) => !v)}
                  aria-expanded={managingTags}
                >
                  {managingTags ? "Done" : "Delete tags"}
                </button>
              ) : null}
            </div>
            {managingTags && tags.length ? (
              <div className="tag-manager">
                <p>Deleting a tag removes it from all movies and series.</p>
                <div className="tag-tabs">
                  {tags.map((t) => (
                    <button
                      key={t.id}
                      disabled={tagBusy || !!busy}
                      onClick={() => void deleteTag(t)}
                      aria-label={"Delete tag " + t.name}
                    >
                      {t.name} ×
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {creatingTag ? (
              <form className="new-tag" onSubmit={addTag}>
                <input
                  aria-label="New tag name"
                  placeholder="e.g. Anime"
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  maxLength={30}
                  required
                  autoFocus
                />
                <button className="primary" disabled={tagBusy}>
                  {tagBusy ? "Creating…" : "Create tag"}
                </button>
              </form>
            ) : null}
            {selectedTags.length > 1 ? (
              <p className="tag-hint">Showing titles with all selected tags.</p>
            ) : null}
            <div className="list-tools">
              <label className="list-filter">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="10" cy="10" r="6" />
                  <path d="m15 15 5 5" />
                </svg>
                <input
                  aria-label="Filter your list"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </label>
              <label className="sort-label">
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  aria-label="Sort movies"
                >
                  <option value="recent">
                    Recently {tab === "watched" ? "watched" : "added"}
                  </option>
                  <option value="rating">IMDb rating</option>
                  <option value="title">Title A–Z</option>
                  <option value="tags">Tags A–Z</option>
                  <option value="year">Release year</option>
                </select>
              </label>
            </div>
            {error ? (
              <div className="error error-bar" role="alert">
                {error}{" "}
                <button
                  className="text-button"
                  onClick={() => void refresh()}
                  disabled={refreshing}
                >
                  Try again
                </button>
              </div>
            ) : null}
            <p className="notice" role="status">
              {notice}
            </p>
            {!catalog && loaded ? (
              <p className="connection-note">
                Movie search isn’t connected yet. You can add films by title.
              </p>
            ) : null}
            {!ratings && loaded ? (
              <p className="connection-note">
                IMDb ratings will be available once OMDb is connected.
              </p>
            ) : null}
            {!loaded ? (
              <p className="empty">Loading our list…</p>
            ) : visible.length ? (
              <div className="movie-grid">
                {visible.map((movie) => (
                  <article
                    id={"movie-" + movie.id}
                    key={movie.id}
                    className={
                      "movie" + (randomId === movie.id ? " chosen" : "")
                    }
                  >
                    <div className="poster-wrap">
                      <Poster movie={movie} />
                      <button
                        className={
                          "watch-toggle" + (movie.watched ? " checked" : "")
                        }
                        disabled={busy === movie.id}
                        aria-label={
                          (movie.watched
                            ? "Move back to watchlist: "
                            : "Mark watched: ") + movie.title
                        }
                        title={
                          movie.watched
                            ? "Move back to watchlist"
                            : "Mark watched"
                        }
                        onClick={() => void update(movie)}
                      >
                        {busy === movie.id ? "…" : "✓"}
                      </button>
                      {randomId === movie.id ? (
                        <span className="tonight">Tonight’s pick</span>
                      ) : null}
                    </div>
                    <div className="movie-info">
                      <div className="movie-meta">
                        <span>
                          {movie.year || "Year unknown"}
                          {movie.mediaType === "tv" ? " · Series" : ""}
                        </span>
                        {movie.rating ? (
                          <a
                            className="rating"
                            href={
                              "https://www.imdb.com/title/" + movie.imdbId + "/"
                            }
                            target="_blank"
                            rel="noreferrer"
                            aria-label={
                              "IMDb rating " + movie.rating + " out of 10"
                            }
                          >
                            <span>IMDb</span> {movie.rating}
                          </a>
                        ) : (
                          <span className="unrated">IMDb —</span>
                        )}
                      </div>
                      <h3>{movie.title}</h3>
                      <div className="movie-bottom">
                        <details className="movie-tags">
                          <summary>
                            {(movie.tags || []).length
                              ? (movie.tags || [])
                                  .map(
                                    (id) => tags.find((t) => t.id === id)?.name,
                                  )
                                  .filter(Boolean)
                                  .join(" · ")
                              : "Add tags"}
                          </summary>
                          <fieldset disabled={busy === movie.id}>
                            <legend className="sr-only">
                              Tags for {movie.title}
                            </legend>
                            {tags.length ? (
                              tags.map((t) => (
                                <label key={t.id}>
                                  <input
                                    type="checkbox"
                                    checked={(movie.tags || []).includes(t.id)}
                                    onChange={(e) =>
                                      void tagMovie(
                                        movie,
                                        e.target.checked
                                          ? [...(movie.tags || []), t.id]
                                          : (movie.tags || []).filter(
                                              (id) => id !== t.id,
                                            ),
                                      )
                                    }
                                  />
                                  {t.name}
                                </label>
                              ))
                            ) : (
                              <p>Create a tag using “New tag” above.</p>
                            )}
                          </fieldset>
                        </details>
                        <button
                          className="remove"
                          aria-label={"Remove " + movie.title}
                          onClick={() => void update(movie, true)}
                          disabled={busy === movie.id}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty">
                {filter || selectedTags.length ? (
                  <p role="status">No matching films.</p>
                ) : (
                  <button className="primary" onClick={() => setAdding(true)}>
                    Add movie
                  </button>
                )}
              </div>
            )}
          </section>
        </main>
      )}
      <Credits />
      <dialog
        ref={dialog}
        className="add-dialog"
        onCancel={() => setAdding(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setAdding(false);
        }}
      >
        {adding ? (
          <AddMovie
            existing={movies}
            onClose={() => setAdding(false)}
            onAdd={(movie, duplicate) => {
              setMovies((ms) => [
                movie,
                ...ms.filter((m) => m.id !== movie.id),
              ]);
              setNotice(
                duplicate
                  ? "That film is already in our " +
                      (movie.watched ? "watched list." : "watchlist.")
                  : movie.title + " added to our watchlist.",
              );
              setAdding(false);
              setTab(movie.watched ? "watched" : "watchlist");
              setFilter("");
            }}
          />
        ) : null}
      </dialog>
    </>
  );
}

function AddMovie({
  existing,
  onClose,
  onAdd,
}: {
  existing: Movie[];
  onClose: () => void;
  onAdd: (movie: Movie, duplicate: boolean) => void;
}) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState<SearchMovie[]>([]),
    [searching, setSearching] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<string | null>(null),
    [manual, setManual] = useState(false),
    [year, setYear] = useState(""),
    [didSearch, setDidSearch] = useState(false);
  useEffect(() => {
    if (manual || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      setDidSearch(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch("/api/search?q=" + encodeURIComponent(query), {
          signal: controller.signal,
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setResults(d.results);
        setError("");
        setDidSearch(true);
      } catch (e) {
        if (!controller.signal.aborted) {
          setError((e as Error).message);
          setResults([]);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, manual]);
  async function add(movie?: SearchMovie) {
    setBusy(movie?.id || "manual");
    setError("");
    try {
      const d = await api(
        "movies",
        "POST",
        movie ? { tmdbId: movie.id } : { title: query, year },
      );
      onAdd(d.movie, !!d.alreadyAdded);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="dialog-content">
      <div className="dialog-title">
        <div>
          <h2>Find a movie or series.</h2>
          <p>Save something worth staying in for.</p>
        </div>
        <button
          className="close"
          aria-label="Close movie search"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="search-modes">
        <button
          className={!manual ? "selected" : ""}
          onClick={() => {
            setManual(false);
            setError("");
          }}
        >
          Search movies
        </button>
        <button
          className={manual ? "selected" : ""}
          onClick={() => {
            setManual(true);
            setError("");
          }}
        >
          Add by title
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manual) void add();
        }}
      >
        <label className="field-label" htmlFor="movie-search">
          {manual ? "Movie title" : "Search movies and series"}
        </label>
        <input
          id="movie-search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Interstellar"
          maxLength={150}
          required
          autoComplete="off"
        />
        {manual ? (
          <>
            <label className="field-label" htmlFor="movie-year">
              Release year (optional)
            </label>
            <input
              id="movie-year"
              inputMode="numeric"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 2014"
              pattern="[0-9]{4}"
              maxLength={4}
            />
            <p className="form-note">
              Saved by title, without a poster or IMDb rating.
            </p>
            <button className="primary" disabled={!!busy || !query.trim()}>
              {busy ? "Adding…" : "Add to our watchlist"}
            </button>
          </>
        ) : null}
      </form>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div role="status" className="search-status">
        {!manual
          ? searching
            ? "Searching movies…"
            : didSearch && !results.length
              ? "No movies found. Try another spelling or add by title."
              : query.length < 2
                ? "Type at least two letters to search."
                : ""
          : ""}
      </div>
      {!manual ? (
        <ul className="search-results">
          {results.map((m) => {
            const saved = existing.find((x) => x.id === m.id);
            return (
              <li key={m.id}>
                <Poster movie={m} small />
                <div>
                  <h3>{m.title}</h3>
                  <p>
                    {m.year || "Release year unavailable"} ·{" "}
                    {m.mediaType === "tv" ? "Series" : "Movie"}
                  </p>
                </div>
                <button
                  className="result-add"
                  disabled={!!busy || !!saved}
                  onClick={() => void add(m)}
                  aria-label={"Add " + m.title}
                >
                  {saved
                    ? saved.watched
                      ? "Watched"
                      : "In list"
                    : busy === m.id
                      ? "Adding…"
                      : "+ Add"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
