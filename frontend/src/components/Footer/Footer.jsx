import { useMemo } from "react";
import { useRegion } from "../../context/useRegion.js";
import "./Footer.css";

export default function Footer() {
  const { selectedCity, clubsInCity, selectedClubId } = useRegion();

  // выбранный клуб: по selectedClubId, иначе первый в городе
  const club = useMemo(() => {
    if (!Array.isArray(clubsInCity) || clubsInCity.length === 0) return null;
    return clubsInCity.find((c) => c.id === selectedClubId) || clubsInCity[0];
  }, [clubsInCity, selectedClubId]);

  const phone = club?.phone || "+7 (999) 123-45-67";
  const address = club?.address || `г. ${selectedCity || "—"}, адрес уточняется`;
  const workHours = club?.work_hours || "Часы работы уточняются";

  // маленькая подсказка под адресом (можешь поменять текст)
  const hint = club
    ? `Филиал: “${club.name}”.`
    : "Выберите город — и появятся контакты филиала.";

  // если work_hours = "24/7" — красиво покажем
  const workHoursRows = useMemo(() => {
    if (!workHours) return [];
    if (workHours.toLowerCase() === "24/7" || workHours.toLowerCase() === "24x7") {
      return [{ left: "Ежедневно", right: "Круглосуточно" }];
    }

    // если у тебя в БД work_hours хранится одной строкой типа "10:00–02:00"
    // покажем одной строкой
    return [{ left: "График", right: workHours }];
  }, [workHours]);

  return (
    <footer className="siteFooter" role="contentinfo">
      <div className="container siteFooter__inner">
        <div className="siteFooter__col">
          <div className="siteFooter__title">Pyramids</div>
          <div className="siteFooter__text">
            Сеть компьютерных клубов: игра, турниры и комфортные зоны.
          </div>

          <div className="siteFooter__contacts">
            <a className="siteFooter__phone" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
              {phone}
            </a>

            <div className="siteFooter__icons" aria-label="Соцсети">
              <a
                className="iconBtn"
                href="https://t.me/"
                target="_blank"
                rel="noreferrer"
                aria-label="Telegram"
                title="Telegram"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9.7 15.3 9.5 19c.4 0 .6-.2.8-.4l1.9-1.8 3.9 2.8c.7.4 1.2.2 1.4-.7l2.5-11.8c.3-1.1-.4-1.6-1.2-1.3L4.2 9.6c-1 .4-1 1.1-.2 1.4l3.7 1.1 8.6-5.4c.4-.3.8-.1.5.2" />
                </svg>
              </a>

              <a
                className="iconBtn"
                href="https://vk.com/"
                target="_blank"
                rel="noreferrer"
                aria-label="VK"
                title="VK"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.7 16.6h1.1s.3 0 .5-.2c.2-.2.2-.6.2-.6s0-1.8.8-2.1c.8-.3 1.9 1.7 3 2.5.8.6 1.4.4 1.4.4l2.8 0s1.5-.1.8-1.3c-.1-.1-.6-1.3-3.1-3.6-2.6-2.4-2.3-2-.9-6.1.8-2.3 1.1-3.3-.2-3.3h-3.2s-.2 0-.3.1c-.2.1-.3.3-.3.3s-.5 1.3-1.2 2.8c-1.4 2.9-2 3.1-2.2 2.9-.6-.4-.4-1.7-.4-2.6 0-2.8.4-4-.8-4.3-.4-.1-.7-.2-1.7-.2-1.3 0-2.4 0-3 .3-.4.2-.7.6-.5.6.2 0 .6.1.9.4.4.6.4 1.9.4 1.9s.2 3.3-.5 3.7c-.5.3-1.3-.3-2.4-2.9-.6-1.4-1-2.9-1-2.9s-.1-.2-.2-.3c-.2-.1-.4-.2-.4-.2H1.6s-.5 0-.7.2c-.2.2 0 .6 0 .6s2.4 5.6 5.1 8.5c2.5 2.7 5.4 2.5 5.4 2.5z" />
                </svg>
              </a>

              <a
                className="iconBtn"
                href="https://rutube.ru/"
                target="_blank"
                rel="noreferrer"
                aria-label="RuTube"
                title="RuTube"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 8.5v7l7-3.5-7-3.5z" />
                  <path d="M12 2.5C6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5 21.5 17.2 21.5 12 17.2 2.5 12 2.5zm0 2c4.1 0 7.5 3.4 7.5 7.5S16.1 19.5 12 19.5 4.5 16.1 4.5 12 7.9 4.5 12 4.5z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="siteFooter__col">
          <div className="siteFooter__title">Адрес</div>
          <div className="siteFooter__text">{address}</div>
          <div className="siteFooter__hint text-muted">{hint}</div>
        </div>

        <div className="siteFooter__col">
          <div className="siteFooter__title">Часы работы</div>

          <div className="workHours">
            {workHoursRows.map((row, idx) => (
              <div className="workHours__row" key={idx}>
                <span>{row.left}</span>
                <span className="text-muted">{row.right}</span>
              </div>
            ))}

            {!workHoursRows.length && (
              <div className="workHours__row">
                <span>График</span>
                <span className="text-muted">Уточняется</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="siteFooter__bottom">
        <div className="container siteFooter__bottomInner">
          <span className="text-muted">© {new Date().getFullYear()} Pyramids</span>
        </div>
      </div>
    </footer>
  );
}
