import { useEffect, useState } from "react";
import { services as servicesApi } from "../../api";
import { useRegion } from "../../context/useRegion.js";
import "./Services.css";

function formatPrice(s) {
  const currency = s.currency || "RUB";
  const sym = currency === "RUB" ? "₽" : currency;

  if (s.price_per_hour != null) return `${s.price_per_hour} ${sym} / час`;
  if (s.price_fixed != null) return `${s.price_fixed} ${sym}`;
  return "Цена уточняется";
}

export default function Services() {
  const { selectedClubId } = useRegion();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setErr("");
        setLoading(true);

        const data = await servicesApi.list({
          clubId: selectedClubId,
        });

        if (!alive) return;

        setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Ошибка загрузки услуг");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [selectedClubId]);

  return (
    <div className="servicesPage">
      <div className="servicesPage__head">
        <h1 className="servicesPage__title">Услуги</h1>
        <p className="servicesPage__subtitle">
          Актуальные цены и описание услуг сети компьютерных клубов Pyramids.
        </p>
      </div>

      {loading && <div className="servicesPage__state">Загрузка...</div>}

      {err && (
        <div className="servicesPage__state servicesPage__state--err">
          {err}
        </div>
      )}

      {!loading && !err && (
        <div className="servicesGrid">
          {items.map((s) => (
            <div className="servicesCard" key={s.id}>
              <div className="servicesCard__top">
                <h3 className="servicesCard__name">{s.name}</h3>
                <div className="servicesCard__price">{formatPrice(s)}</div>
              </div>

              <p className="servicesCard__desc">
                {s.description || "Описание появится позже"}
              </p>
            </div>
          ))}

          {items.length === 0 && (
            <div className="servicesPage__state">
              Нет услуг для выбранного клуба
            </div>
          )}
        </div>
      )}
    </div>
  );
}