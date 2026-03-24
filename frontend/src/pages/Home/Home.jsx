import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Carousel from "../../components/Carousel/Carousel.jsx";
import { services as servicesApi, tournaments as tournamentsApi } from "../../api";
import { useRegion } from "../../context/useRegion.js";
import "./Home.css";

function formatPrice(s) {
  if (!s) return "Цена уточняется";
  const currency = s.currency || "RUB";
  const sym = currency === "RUB" ? "₽" : currency;

  if (s.price_per_hour != null) return `${s.price_per_hour} ${sym} / час`;
  if (s.price_fixed != null) return `${s.price_fixed} ${sym}`;
  return "Цена уточняется";
}

function formatMoney(v) {
  if (v == null) return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function formatDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatWorkHours(club) {
  if (!club) return "График уточняется";
  return club.work_hours || "График уточняется";
}

export default function Home() {
  const navigate = useNavigate();
  const { clubsInCity, selectedClubId } = useRegion();

  const [services, setServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  const [tournaments, setTournaments] = useState([]);
  const [rating, setRating] = useState([]);
  const [tournamentsLoading, setTournamentsLoading] = useState(false);

  const currentClub = useMemo(() => {
    if (!Array.isArray(clubsInCity) || !clubsInCity.length) return null;
    return clubsInCity.find((c) => c.id === selectedClubId) || clubsInCity[0];
  }, [clubsInCity, selectedClubId]);

  useEffect(() => {
    let alive = true;

    async function loadServices() {
      if (!selectedClubId) {
        setServices([]);
        return;
      }

      try {
        setServicesLoading(true);
        const data = await servicesApi.list({ clubId: selectedClubId });
        if (!alive) return;
        setServices(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!alive) return;
        setServices([]);
      } finally {
        if (alive) setServicesLoading(false);
      }
    }

    loadServices();

    return () => {
      alive = false;
    };
  }, [selectedClubId]);

  useEffect(() => {
    let alive = true;

    async function loadTournaments() {
      try {
        setTournamentsLoading(true);
        const data = await tournamentsApi.summary(selectedClubId || null);
        if (!alive) return;

        setTournaments(Array.isArray(data?.tournaments) ? data.tournaments : []);
        setRating(Array.isArray(data?.rating) ? data.rating : []);
      } catch {
        if (!alive) return;
        setTournaments([]);
        setRating([]);
      } finally {
        if (alive) setTournamentsLoading(false);
      }
    }

    loadTournaments();

    return () => {
      alive = false;
    };
  }, [selectedClubId]);

  const topServices = useMemo(() => services.slice(0, 4), [services]);

  const futureTournaments = useMemo(() => {
    const now = new Date();
    return tournaments.filter((t) => {
      if (!t?.starts_at) return false;
      const d = new Date(t.starts_at);
      return !Number.isNaN(d.getTime()) && d > now;
    });
  }, [tournaments]);

  const nearestTournament = useMemo(() => {
    if (!futureTournaments.length) return null;
    return [...futureTournaments].sort(
      (a, b) => new Date(a.starts_at) - new Date(b.starts_at)
    )[0];
  }, [futureTournaments]);

  const slides = useMemo(() => {
    return [
      {
        id: 1,
        kicker: "Сеть компьютерных клубов",
        title: currentClub
          ? `${currentClub.name} — играй с комфортом`
          : "Pyramids — играй с комфортом",
        text: currentClub
          ? `Выбранный клуб: ${currentClub.address}. Актуальный график: ${formatWorkHours(
              currentClub
            )}. Удобное бронирование, турниры и игровые места в одном сервисе.`
          : "Выбирай клуб, услугу, время и бронируй место заранее.",
        ctaPrimary: "Бронировать",
        ctaSecondary: "Клубы и контакты",
        stats: [
          {
            value: clubsInCity?.length || 0,
            label: "Клубов доступно",
          },
          {
            value: servicesLoading ? "..." : services.length || 0,
            label: "Услуг доступно",
          },
          {
            value: tournamentsLoading ? "..." : tournaments.length || 0,
            label: "Турниров в базе",
          },
        ],
      },
      {
        id: 2,
        kicker: "Актуальные услуги и цены",
        title: "Играй на ПК, консоли и VR",
        text:
          topServices.length > 0
            ? topServices.map((s) => `${s.name} — ${formatPrice(s)}`).join(" • ")
            : "Для выбранного клуба цены пока не загружены.",
        ctaPrimary: "Смотреть услуги",
        ctaSecondary: "Выбрать время",
        stats: [
          {
            value: topServices[0] ? formatPrice(topServices[0]) : "—",
            label: topServices[0]?.name || "Первая услуга",
          },
          {
            value: topServices[1] ? formatPrice(topServices[1]) : "—",
            label: topServices[1]?.name || "Вторая услуга",
          },
          {
            value: topServices[2] ? formatPrice(topServices[2]) : "—",
            label: topServices[2]?.name || "Третья услуга",
          },
        ],
      },
      {
        id: 3,
        kicker: "Турниры и рейтинг команд",
        title: nearestTournament
          ? nearestTournament.name
          : "Следи за турнирами Pyramids",
        text: nearestTournament
          ? `Ближайший турнир: ${nearestTournament.game || "игровая дисциплина"}, ${
              nearestTournament.city || "—"
            }. Команд: ${nearestTournament.teams_count ?? 0}.`
          : "В системе можно смотреть турниры клуба и отслеживать будущие события.",
        ctaPrimary: "Открыть турниры",
        ctaSecondary: "Рейтинг команд",
        stats: [
          {
            value: nearestTournament?.game || "—",
            label: "Дисциплина",
          },
          {
            value: nearestTournament?.teams_count ?? 0,
            label: "Команд",
          },
          {
            value: rating[0]?.name || "—",
            label: rating[0]
              ? `Лидер рейтинга: ${rating[0].points} очков`
              : "Рейтинг команд",
          },
        ],
      },
    ];
  }, [
    currentClub,
    clubsInCity,
    services,
    servicesLoading,
    tournaments,
    tournamentsLoading,
    topServices,
    nearestTournament,
    rating,
  ]);

  return (
    <main className="home">
      <Carousel
        slides={slides}
        autoplayMs={0}
        ariaLabel="Главная витрина Pyramids"
        renderSlide={(s) => (
          <div className="container">
            <div className="homeHero card">
              <div className="homeHero__left">
                <span className="badge">{s.kicker}</span>
                <h1 className="homeHero__title">{s.title}</h1>
                <p className="homeHero__text text-muted">{s.text}</p>

                <div className="homeHero__actions">
                  <button
                    className="btn btn--primary"
                    type="button"
                    onClick={() => {
                      if (s.ctaPrimary === "Бронировать" || s.ctaPrimary === "Выбрать время") {
                        navigate("/booking");
                        return;
                      }
                      if (s.ctaPrimary === "Смотреть услуги") {
                        navigate("/services");
                        return;
                      }
                      if (s.ctaPrimary === "Открыть турниры") {
                        navigate("/tournaments");
                      }
                    }}
                  >
                    {s.ctaPrimary}
                  </button>

                  <button
                    className="btn"
                    type="button"
                    onClick={() => {
                      if (s.ctaSecondary === "Клубы и контакты") {
                        navigate("/contacts");
                        return;
                      }
                      if (s.ctaSecondary === "Выбрать время") {
                        navigate("/booking");
                        return;
                      }
                      if (s.ctaSecondary === "Рейтинг команд") {
                        navigate("/tournaments");
                        return;
                      }
                      navigate("/services");
                    }}
                  >
                    {s.ctaSecondary}
                  </button>
                </div>
              </div>

              <div className="homeHero__right">
                {s.stats.map((item, idx) => (
                  <div className="homeHero__stat" key={idx}>
                    <div className="homeHero__statValue">{item.value}</div>
                    <div className="homeHero__statLabel text-muted">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      />

      <section className="container homeSection">
        <div className="hr" />

        <div className="card homePanel homePanel--full">
          <div className="homePanel__head">
            <div>
              <h2 className="homePanel__title">Популярные услуги</h2>
              <p className="text-muted homePanel__sub">
                Хочешь играть с нами — бронируй свободное место, выбирай удобное время
                и приходи в свой клуб Pyramids.
              </p>
            </div>

            <button
              type="button"
              className="btn btn--primary"
              onClick={() => navigate("/booking")}
            >
              Перейти к бронированию
            </button>
          </div>

          {topServices.length === 0 ? (
            <div className="text-muted">Услуги пока не загружены.</div>
          ) : (
            <div className="homeServicesGrid">
              {topServices.map((s) => (
                <div className="homeServiceCard" key={s.id}>
                  <div className="homeServiceCard__top">
                    <div className="homeServiceCard__title">{s.name}</div>
                    <div className="homeServiceCard__price">{formatPrice(s)}</div>
                  </div>
                  <div className="text-muted small">
                    {s.description || "Описание появится позже"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card homePanel homePanel--full">
          <h2 className="homePanel__title">Ближайший будущий турнир</h2>

          {!nearestTournament ? (
            <div className="text-muted">Будущих турниров пока нет.</div>
          ) : (
            <div className="homeNearestTournament">
              <div className="homeNearestTournament__name">
                {nearestTournament.name}
              </div>

              <div className="homeNearestTournament__meta">
                <span>{nearestTournament.game || "Игра"}</span>
                <span>{nearestTournament.city || "—"}</span>
                <span>{nearestTournament.status_name || "—"}</span>
              </div>

              <div className="homeNearestTournament__grid">
                <div>
                  <div className="text-muted small">Начало</div>
                  <div>{formatDateTime(nearestTournament.starts_at)}</div>
                </div>
                <div>
                  <div className="text-muted small">Окончание</div>
                  <div>{formatDateTime(nearestTournament.ends_at)}</div>
                </div>
                <div>
                  <div className="text-muted small">Команд</div>
                  <div>{nearestTournament.teams_count ?? 0}</div>
                </div>
                <div>
                  <div className="text-muted small">Взнос</div>
                  <div>{formatMoney(nearestTournament.entry_fee)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card homePanel homePanel--full">
          <div className="homePanel__head">
            <h2 className="homePanel__title">Турниры клуба</h2>
          </div>

          {tournaments.length === 0 ? (
            <div className="text-muted">Турниры пока не добавлены.</div>
          ) : (
            <div className="tableWrap">
              <table className="homeTable">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Игра</th>
                    <th>Город</th>
                    <th>Статус</th>
                    <th>Начало</th>
                    <th>Окончание</th>
                    <th>Команд</th>
                    <th>Взнос</th>
                    <th>Призовой фонд</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td>{t.game || "—"}</td>
                      <td>{t.city || "—"}</td>
                      <td>{t.status_name || "—"}</td>
                      <td>{formatDateTime(t.starts_at)}</td>
                      <td>{formatDateTime(t.ends_at)}</td>
                      <td>{t.teams_count ?? 0}</td>
                      <td>{formatMoney(t.entry_fee)}</td>
                      <td>{formatMoney(t.prize_pool)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card homeInvite">
          <div className="homeInvite__title">Ждём тебя в Pyramids</div>

          <p className="homeInvite__text text-muted">
            Приходи играть, собирай команду, участвуй в турнирах и следи за нашими
            новостями. Мы рады как новичкам, так и постоянным игрокам.
          </p>

          <div className="homeInvite__links">
            <a href="https://vk.com/" target="_blank" rel="noreferrer">
              VK
            </a>
            <a href="https://t.me/" target="_blank" rel="noreferrer">
              Telegram
            </a>
            <a href="https://rutube.ru/" target="_blank" rel="noreferrer">
              RuTube
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}