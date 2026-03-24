import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { clubs as clubsApi } from "../../api/index.js";
import { useRegion } from "../../context/useRegion.js";
import "./Contacts.css";

// фикс для иконок leaflet в сборщиках
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    const valid = points
      .filter((p) => typeof p.latitude === "number" && typeof p.longitude === "number")
      .map((p) => [p.latitude, p.longitude]);

    if (!valid.length) return;

    if (valid.length === 1) {
      map.setView(valid[0], 13);
      return;
    }

    map.fitBounds(valid, { padding: [24, 24] });
  }, [map, points]);

  return null;
}

export default function Contacts() {
  const { selectedCity } = useRegion();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;

    const load = async () => {
        try {
        setErr("");
        setLoading(true);

        const data = await clubsApi.list({ city: selectedCity });
        if (alive) {
            setItems(Array.isArray(data?.items) ? data.items : []);
        }
        } catch (e) {
        if (alive) {
            setErr(e?.message || "Не удалось загрузить клубы");
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
    }, [selectedCity]);

  const points = useMemo(() => items, [items]);

  // если нет данных — центр по Москве (чтобы карта не падала)
  const fallbackCenter = [55.7558, 37.6173];

  return (
    <div className="contactsPage">
      <div className="container contactsLayout">
        <div className="contactsLeft">
          <div className="contactsHeader">
            <h1 className="contactsTitle">Адрес и контакты</h1>
            <p className="contactsSubtitle">
              Текущий город: <span className="accent">{selectedCity}</span>
            </p>
          </div>

          {loading && <div className="contactsState">Загрузка...</div>}
          {err && <div className="contactsState contactsState--err">{err}</div>}

          {!loading && !err && (
            <div className="contactsList">
              {items.map((club) => (
                <article className="contactsCard" key={club.id}>
                  <div className="contactsCardTop">
                    <div>
                      <div className="contactsName">{club.name}</div>
                      <div className="contactsBadge">{club.work_hours || "Часы уточняются"}</div>
                    </div>
                  </div>

                  <div className="contactsRow">
                    <div className="contactsKey">Адрес</div>
                    <div className="contactsVal">{club.address}</div>
                  </div>

                  <div className="contactsRow">
                    <div className="contactsKey">Телефон</div>
                    <div className="contactsVal">
                      {club.phone ? (
                        <a className="contactsLink" href={`tel:${club.phone.replace(/[^\d+]/g, "")}`}>
                          {club.phone}
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </div>
                  </div>

                  <div className="contactsRow">
                    <div className="contactsKey">Соцсети</div>
                    <div className="contactsVal contactsSocials">
                      <a className="socialBtn" href="#" aria-label="Telegram">TG</a>
                      <a className="socialBtn" href="#" aria-label="VK">VK</a>
                      <a className="socialBtn" href="#" aria-label="RuTube">RT</a>
                    </div>
                  </div>
                </article>
              ))}

              {items.length === 0 && (
                <div className="contactsState">
                  В городе <b>{selectedCity}</b> пока нет клубов.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="contactsRight">
          <div className="mapCard">
            <div className="mapTitle">Карта клубов</div>

            <MapContainer
              center={fallbackCenter}
              zoom={11}
              scrollWheelZoom={false}
              style={{ height: 520, width: "100%", borderRadius: 18 }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <FitBounds points={points} />

              {points
                .filter((p) => typeof p.latitude === "number" && typeof p.longitude === "number")
                .map((club) => (
                  <Marker
                    key={club.id}
                    position={[club.latitude, club.longitude]}
                    icon={markerIcon}
                  >
                    <Popup>
                      <b>{club.name}</b>
                      <br />
                      {club.address}
                      <br />
                      {club.phone || ""}
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>

            <div className="mapHint">
              Точки меняются по выбранному городу в хедере.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}