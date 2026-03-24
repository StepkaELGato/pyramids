import { useEffect, useMemo, useState } from "react";
import { useRegion } from "../../context/useRegion.js";
import { tournaments as tournamentsApi } from "../../api";
import "./Tournaments.css";

const MOCK_GALLERY = [
  { src: "/images/tournaments/tour-1.png", alt: "Матч на сцене" },
  { src: "/images/tournaments/tour-2.png", alt: "Зона зрителей" },
  { src: "/images/tournaments/tour-3.png", alt: "Команда празднует победу" },
  { src: "/images/tournaments/tour-4.png", alt: "Игроки за ПК" },
];

function formatMoney(v) {
  if (v === null || v === undefined) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function formatDateTime(v) {
  if (!v) return "—";
  // приходит ISO или строка — покажем по-русски
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

export default function Tournaments() {
  const { selectedCity, selectedClubId } = useRegion();

  const [filter, setFilter] = useState("all");
  const [lightbox, setLightbox] = useState(null);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [rating, setRating] = useState([]);
  const [tournaments, setTournaments] = useState([]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
        setErr("");
        setLoading(true);

        try {
        const data = await tournamentsApi.summary(selectedClubId);

        if (alive) {
            setRating(Array.isArray(data?.rating) ? data.rating : []);
            setTournaments(Array.isArray(data?.tournaments) ? data.tournaments : []);
        }
        } catch (e) {
        if (alive) {
            setErr(e?.message || "Ошибка загрузки турниров");
            setRating([]);
            setTournaments([]);
        }
        } finally {
        if (alive) {
            setLoading(false);
        }
        }
    };

    load();

    return () => {
        alive = false;
    };
    }, [selectedClubId]);

  const games = useMemo(() => {
    // соберём уникальные игры из БД
    const set = new Set();
    tournaments.forEach((t) => {
      if (t?.game) set.add(t.game);
    });
    return Array.from(set).slice(0, 6);
  }, [tournaments]);

  const filteredTournaments = useMemo(() => {
    if (filter === "all") return tournaments;
    if (filter === "city") return tournaments.filter((t) => t.city === selectedCity);
    return tournaments.filter((t) => t.game === filter);
  }, [filter, selectedCity, tournaments]);

  return (
    <div className="tournamentsPage container">
      {/* HERO */}
      <section className="tournamentsHero card">
        <div className="tournamentsHero__top">
          <h1 className="tournamentsHero__title">Турниры Pyramids</h1>
          <div className="tournamentsHero__badge">
            Активный регион: <b>{selectedCity}</b>
          </div>
        </div>

        <p className="tournamentsHero__text text-muted">
          Рейтинг команд, ближайшие турниры и атмосфера наших соревнований.
          Выбирай город и следи за расписанием!
        </p>

        <div className="tournamentsHero__filters">
          <button
            type="button"
            className={`chip ${filter === "all" ? "chip--active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Все
          </button>

          <button
            type="button"
            className={`chip ${filter === "city" ? "chip--active" : ""}`}
            onClick={() => setFilter("city")}
          >
            В моём городе
          </button>

          {games.map((g) => (
            <button
              key={g}
              type="button"
              className={`chip ${filter === g ? "chip--active" : ""}`}
              onClick={() => setFilter(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </section>

      {/* STATES */}
      {loading && <div className="tournamentsState card">Загрузка...</div>}
      {err && !loading && <div className="tournamentsState card tournamentsState--err">{err}</div>}

      {!loading && !err && (
        <section className="tournamentsGrid">
          {/* Rating */}
          <div className="card tournamentsBlock">
            <div className="tournamentsBlock__head">
              <h2 className="tournamentsBlock__title">Рейтинг команд</h2>
              <div className="tournamentsBlock__hint text-muted">
                По количеству участий
              </div>
            </div>

            <div className="ratingTable">
              <div className="ratingRow ratingRow--head">
                <span>#</span>
                <span>Команда</span>
                <span>Очки</span>
                <span>Участий</span>
              </div>

              {rating.map((t, idx) => (
                <div className="ratingRow" key={t.id}>
                  <span className="ratingRank">{idx + 1}</span>
                  <span className="ratingTeam">{t.name}</span>
                  <span className="ratingPoints">{t.points}</span>
                  <span className="ratingWL text-muted">{t.participations}</span>
                </div>
              ))}
            </div>

            {rating.length === 0 && (
              <div className="tournamentsNote text-muted">
                Пока нет данных для рейтинга (нет связей tournament_teams).
              </div>
            )}
          </div>

          {/* Upcoming tournaments */}
          <div className="card tournamentsBlock">
            <div className="tournamentsBlock__head">
              <h2 className="tournamentsBlock__title">Ближайшие турниры</h2>
              <div className="tournamentsBlock__hint text-muted">
                Фильтр:{" "}
                {filter === "city" ? selectedCity : filter === "all" ? "Все" : filter}
              </div>
            </div>

            <div className="matchesList">
              {filteredTournaments.map((t) => (
                <article className="matchCard" key={t.id}>
                  <div className="matchCard__top">
                    <div className="matchCard__meta">
                      <span className="badge">{t.game || "Игра"}</span>
                      <span className="matchCard__stage">{t.status_name}</span>
                    </div>
                    <div className="matchCard__time text-muted">
                      {formatDateTime(t.starts_at)}
                    </div>
                  </div>

                  <div className="tournamentTitle">{t.name}</div>

                  {t.description && (
                    <div className="tournamentDesc text-muted">{t.description}</div>
                  )}

                  <div className="matchCard__bottom">
                    <span className="text-muted">Город:</span> <b>{t.city}</b>{" "}
                    <span className="text-muted">• Команд:</span>{" "}
                    <b>{t.teams_count ?? 0}</b>
                  </div>

                  <div className="tournamentMoney">
                    <div>
                      <span className="text-muted">Взнос:</span> <b>{formatMoney(t.entry_fee)}</b>
                    </div>
                    <div>
                      <span className="text-muted">Призовой:</span> <b>{formatMoney(t.prize_pool)}</b>
                    </div>
                  </div>
                </article>
              ))}

              {filteredTournaments.length === 0 && (
                <div className="tournamentsEmpty text-muted">
                  Пока нет турниров по выбранному фильтру.
                </div>
              )}
            </div>
          </div>

          {/* Criteria */}
          <div className="card tournamentsBlock tournamentsBlock--wide">
            <div className="tournamentsBlock__head">
              <h2 className="tournamentsBlock__title">Как попасть в команду</h2>
              <div className="tournamentsBlock__hint text-muted">
                Регистрация будет через администратора (сделаем позже)
              </div>
            </div>

            <div className="criteriaGrid">
              <div className="criteriaItem">
                <div className="criteriaTitle">Возраст и дисциплина</div>
                <div className="criteriaText text-muted">
                  16+ (или с разрешением). Соблюдение правил клуба и уважение к участникам.
                </div>
              </div>

              <div className="criteriaItem">
                <div className="criteriaTitle">Навыки игры</div>
                <div className="criteriaText text-muted">
                  Уверенная база: понимание ролей, коммуникация, стабильный уровень (тест-матч).
                </div>
              </div>

              <div className="criteriaItem">
                <div className="criteriaTitle">Командная игра</div>
                <div className="criteriaText text-muted">
                  Микрофон, умение слушать капитана, готовность тренироваться и разбирать ошибки.
                </div>
              </div>

              <div className="criteriaItem">
                <div className="criteriaTitle">Посещаемость</div>
                <div className="criteriaText text-muted">
                  Минимум 2–3 тренировки в неделю и участие в матчах по расписанию.
                </div>
              </div>
            </div>

            <div className="tournamentsSlogan">
              <span className="tournamentsSlogan__accent">Pyramids:</span>{" "}
              Играй как фараон — побеждай как легенда.
            </div>
          </div>

          {/* Gallery */}
          <div className="card tournamentsBlock tournamentsBlock--wide">
            <div className="tournamentsBlock__head">
              <h2 className="tournamentsBlock__title">Фото с турниров</h2>
            </div>

            <div className="galleryGrid">
              {MOCK_GALLERY.map((img) => (
                <div
                  className="galleryItem"
                  key={img.src}
                  role="button"
                  tabIndex={0}
                  onClick={() => setLightbox(img)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setLightbox(img);
                  }}
                >
                  <img src={img.src} alt={img.alt} loading="lazy" />
                  <div className="galleryCaption text-muted">{img.alt}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="lightbox" role="dialog" aria-label="Просмотр фото" onClick={() => setLightbox(null)}>
          <button className="lightbox__close" type="button" aria-label="Закрыть" onClick={() => setLightbox(null)}>
            ×
          </button>

          <div className="lightbox__content" onClick={(e) => e.stopPropagation()}>
            <img className="lightbox__img" src={lightbox.src} alt={lightbox.alt} />
            <div className="lightbox__cap text-muted">{lightbox.alt}</div>
          </div>
        </div>
      )}
    </div>
  );
}