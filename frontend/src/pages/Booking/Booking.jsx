import { useEffect, useMemo, useState } from "react";
import { useRegion } from "../../context/useRegion.js";
import { services as servicesApi, booking as bookingApi } from "../../api";
import "./Booking.css";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toIsoWithOffset(d) {
  const yyyy = d.getFullYear();
  const mm = pad2(d.getMonth() + 1);
  const dd = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());

  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? "+" : "-";
  const offH = pad2(Math.floor(Math.abs(offMin) / 60));
  const offM = pad2(Math.abs(offMin) % 60);

  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${offH}:${offM}`;
}

function addHoursIso(dateYYYYMMDD, timeHHMM, hours) {
  const [y, m, d] = dateYYYYMMDD.split("-").map(Number);
  const [hh, mm] = timeHHMM.split(":").map(Number);

  const start = new Date(y, m - 1, d, hh, mm, 0, 0);
  const end = new Date(start.getTime() + Number(hours || 1) * 60 * 60 * 1000);

  return {
    startIso: toIsoWithOffset(start),
    endIso: toIsoWithOffset(end),
  };
}

function getWholeDayRange(dateYYYYMMDD) {
  const [y, m, d] = dateYYYYMMDD.split("-").map(Number);

  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);

  return {
    startIso: toIsoWithOffset(start),
    endIso: toIsoWithOffset(end),
  };
}

function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function isValidPhone(phone) {
  if (!phone) return false;
  return /^\+?[0-9]{10,15}$/.test(String(phone).trim());
}

function serviceToDeviceType(service) {
  const code = String(service?.code || "").toLowerCase();
  const name = String(service?.name || "").toLowerCase();

  if (code === "vr" || name.includes("vr")) return "vr";
  if (code === "console" || code === "con" || name.includes("консол")) return "console";
  if (code === "pc" || name.includes("пк")) return "pc";

  return null;
}

function isWholeClubDayService(service) {
  const name = String(service?.name || "").toLowerCase();
  return name.includes("всего клуба на день");
}

function guessDeviceTypeCode(device) {
  const code =
    device?.type_code ||
    device?.type?.code ||
    device?.device_type_code ||
    null;

  if (code) return String(code).toLowerCase();

  const c = String(device?.code || "").toLowerCase();
  if (c.startsWith("pc")) return "pc";
  if (c.startsWith("con")) return "console";
  if (c.startsWith("vr")) return "vr";

  return "pc";
}

function formatUnitPrice(service) {
  if (!service) return "Цена уточняется";
  const currency = service.currency || "RUB";
  const sym = currency === "RUB" ? "₽" : currency;

  if (service.price_per_hour != null) {
    return `${service.price_per_hour} ${sym} / час`;
  }

  if (service.price_fixed != null) {
    return `${service.price_fixed} ${sym}`;
  }

  return "Цена уточняется";
}

function calcTotal(service, hours) {
  if (!service) return null;

  const h = Number(hours || 1);

  if (service.price_per_hour != null) {
    const perHour = Number(service.price_per_hour || 0);
    const fixed = Number(service.price_fixed || 0);
    return Math.round((perHour * h + fixed) * 100) / 100;
  }

  if (service.price_fixed != null) {
    return Number(service.price_fixed);
  }

  return null;
}

function parseWorkHoursRange(workHours) {
  const s = String(workHours || "").trim().toLowerCase();

  if (!s) return null;
  if (s === "24/7" || s === "24x7") {
    return { is24x7: true, startMinutes: 0, endMinutes: 1440 };
  }

  const m = s.match(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;

  return {
    is24x7: false,
    startMinutes: Number(m[1]) * 60 + Number(m[2]),
    endMinutes: Number(m[3]) * 60 + Number(m[4]),
  };
}

function getMinutesFromHHMM(value) {
  const [hh = "0", mm = "0"] = String(value || "").split(":");
  return Number(hh) * 60 + Number(mm);
}

function fitsWorkHours({ time, hours, workHours }) {
  const range = parseWorkHoursRange(workHours);
  if (!range) return true;
  if (range.is24x7) return true;

  const startMinutes = getMinutesFromHHMM(time);
  const endMinutes = startMinutes + Number(hours || 1) * 60;

  // обычный график, например 10:00–22:00
  if (range.startMinutes < range.endMinutes) {
    return startMinutes >= range.startMinutes && endMinutes <= range.endMinutes;
  }

  // ночной график, например 12:00–03:00 или 18:00–02:00
  const startsInWorkingWindow =
    startMinutes >= range.startMinutes || startMinutes < range.endMinutes;

  if (!startsInWorkingWindow) return false;

  // старт до полуночи
  if (startMinutes >= range.startMinutes) {
    if (endMinutes <= 24 * 60) return true;
    return endMinutes - 24 * 60 <= range.endMinutes;
  }

  // старт после полуночи
  return endMinutes <= range.endMinutes;
}

export default function Booking() {
  const {
    selectedCity,
    cities,
    setSelectedCity,
    clubsInCity,
    selectedClubId,
    setSelectedClubId,
  } = useRegion();

  const storedClientId = localStorage.getItem("clientId") || "";
  const isAuthed = Boolean(storedClientId);

  const [guestLastName, setGuestLastName] = useState("");
  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestMiddleName, setGuestMiddleName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const [date, setDate] = useState(tomorrowStr());
  const [time, setTime] = useState("18:00");
  const [hours, setHours] = useState(2);

  const [services, setServices] = useState([]);
  const [serviceId, setServiceId] = useState("");

  const [devices, setDevices] = useState([]);
  const [busyDeviceIds, setBusyDeviceIds] = useState(new Set());
  const [selectedDeviceIds, setSelectedDeviceIds] = useState([]);

  const [comment, setComment] = useState("");

  const [loading, setLoading] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const currentClub = useMemo(() => {
    return (clubsInCity || []).find((x) => Number(x.id) === Number(selectedClubId)) || null;
  }, [clubsInCity, selectedClubId]);

  const clubName = currentClub?.name || "";

  const clubWorkHours = currentClub?.work_hours || "График уточняется";

  const selectedService = useMemo(() => {
    const sid = Number(serviceId);
    return services.find((s) => Number(s.id) === sid) || null;
  }, [services, serviceId]);

  const isWholeDayBooking = useMemo(() => {
    return isWholeClubDayService(selectedService);
  }, [selectedService]);

  const requiredDeviceType = useMemo(
    () => serviceToDeviceType(selectedService),
    [selectedService]
  );

  const { startIso, endIso } = useMemo(() => {
    if (isWholeDayBooking) {
      return getWholeDayRange(date);
    }

    return addHoursIso(date, time, hours);
  }, [date, time, hours, isWholeDayBooking]);

  const filteredDevices = useMemo(() => {
    if (!requiredDeviceType) return [];
    return devices.filter((d) => guessDeviceTypeCode(d) === requiredDeviceType);
  }, [devices, requiredDeviceType]);

  const total = useMemo(() => {
    return calcTotal(selectedService, hours);
  }, [selectedService, hours]);

  const totalText = useMemo(() => {
    if (total == null) return "Цена уточняется";
    const currency = selectedService?.currency || "RUB";
    const sym = currency === "RUB" ? "₽" : currency;
    return `${total} ${sym}`;
  }, [total, selectedService]);

  const bookingFitsWorkHours = useMemo(() => {
    if (isWholeDayBooking) return true;

    return fitsWorkHours({
      time,
      hours,
      workHours: currentClub?.work_hours || "",
    });
  }, [time, hours, currentClub, isWholeDayBooking]);

  const guestName = useMemo(() => {
    return [
      guestLastName.trim(),
      guestFirstName.trim(),
      guestMiddleName.trim(),
    ]
      .filter(Boolean)
      .join(" ");
  }, [guestLastName, guestFirstName, guestMiddleName]);

  useEffect(() => {
    let alive = true;

    async function loadServices() {
      try {
        setErr("");
        setOkMsg("");
        setServicesLoading(true);

        if (!selectedClubId) {
          setServices([]);
          setServiceId("");
          return;
        }

        const data = await servicesApi.list({ clubId: selectedClubId });
        if (!alive) return;

        const items = Array.isArray(data?.items) ? data.items : [];
        setServices(items);

        if (items.length) {
          const exists = items.some((x) => String(x.id) === String(serviceId));
          if (!exists) {
            setServiceId(String(items[0].id));
          }
        } else {
          setServiceId("");
        }
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Ошибка загрузки услуг");
        setServices([]);
        setServiceId("");
      } finally {
        if (alive) setServicesLoading(false);
      }
    }

    loadServices();

    return () => {
      alive = false;
    };
  }, [selectedClubId, serviceId]);

  useEffect(() => {
    let alive = true;

    async function loadMeta() {
      try {
        setErr("");
        setOkMsg("");
        setDevicesLoading(true);

        if (!selectedClubId) {
          setDevices([]);
          setSelectedDeviceIds([]);
          return;
        }

        const meta = await bookingApi.meta({ clubId: selectedClubId });
        if (!alive) return;

        const list = Array.isArray(meta?.devices)
          ? meta.devices
          : Array.isArray(meta?.items)
          ? meta.items
          : [];

        setDevices(list);
        setSelectedDeviceIds([]);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Ошибка загрузки схемы мест");
        setDevices([]);
        setSelectedDeviceIds([]);
      } finally {
        if (alive) setDevicesLoading(false);
      }
    }

    loadMeta();

    return () => {
      alive = false;
    };
  }, [selectedClubId]);

  useEffect(() => {
    let alive = true;

    async function loadAvailability() {
      try {
        setErr("");
        setOkMsg("");
        setAvailabilityLoading(true);

        if (!selectedClubId) {
          setBusyDeviceIds(new Set());
          return;
        }

        const data = await bookingApi.availability({
          clubId: selectedClubId,
          start: startIso,
          end: endIso,
        });

        if (!alive) return;

        const ids = Array.isArray(data?.busyDeviceIds)
          ? data.busyDeviceIds
          : Array.isArray(data?.busy)
          ? data.busy
          : [];

        setBusyDeviceIds(new Set(ids.map(Number)));
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Ошибка проверки доступности");
        setBusyDeviceIds(new Set());
      } finally {
        if (alive) setAvailabilityLoading(false);
      }
    }

    loadAvailability();

    return () => {
      alive = false;
    };
  }, [selectedClubId, startIso, endIso]);

  useEffect(() => {
    setSelectedDeviceIds([]);
  }, [serviceId, requiredDeviceType]);

  function toggleDevice(id) {
    const nid = Number(id);
    if (!nid || busyDeviceIds.has(nid)) return;

    setSelectedDeviceIds((prev) => {
      if (prev.includes(nid)) return [];
      return [nid];
    });
  }

  const canBook = useMemo(() => {
    if (!bookingFitsWorkHours) return false;
    if (!selectedClubId) return false;
    if (!serviceId) return false;
    if (date < tomorrowStr()) return false;
    if (!date) return false;
    if (!isWholeDayBooking && !time) return false;
    if (!isWholeDayBooking && (!hours || Number(hours) <= 0)) return false;

    if (!isWholeDayBooking && requiredDeviceType && selectedDeviceIds.length !== 1) {
      return false;
    }

    if (!isAuthed) {
      if (!guestLastName.trim()) return false;
      if (!guestFirstName.trim()) return false;
      if (!guestMiddleName.trim()) return false;
      if (!guestPhone.trim() || !isValidPhone(guestPhone)) return false;
      if (!guestEmail.trim() || !isValidEmail(guestEmail)) return false;
    }

    return true;
  }, [
    isWholeDayBooking,
    bookingFitsWorkHours,
    selectedClubId,
    serviceId,
    date,
    time,
    hours,
    requiredDeviceType,
    selectedDeviceIds.length,
    isAuthed,
    guestLastName,
    guestFirstName,
    guestMiddleName,
    guestPhone,
    guestEmail,
  ]);

  async function handleBooking() {
    try {
      setErr("");
      setOkMsg("");
      setLoading(true);

      if (!bookingFitsWorkHours) {
        setErr(
          currentClub?.work_hours
            ? `Бронирование возможно только в рабочие часы клуба: ${currentClub.work_hours}`
            : "Выбранное время не входит в рабочие часы клуба"
        );
        return;
      }

      if (!canBook) {
        setErr("Заполните обязательные поля и выберите место");
        return;
      }

      const payload = {
        clubId: Number(selectedClubId),
        serviceId: Number(serviceId),
        startTime: startIso,
        endTime: endIso,
        deviceIds: !isWholeDayBooking && requiredDeviceType ? selectedDeviceIds : [],
        clientId: isAuthed ? Number(storedClientId) : null,
        guestName: isAuthed ? null : guestName,
        guestPhone: isAuthed ? null : guestPhone.trim(),
        guestEmail: isAuthed ? null : guestEmail.trim(),
        comment: comment?.trim() || null,
      };

      const res = await bookingApi.create(payload);

      setOkMsg(res?.message || `Бронь создана! ID: ${res?.bookingId ?? "—"}`);
      setSelectedDeviceIds([]);
      setComment("");

      if (!isAuthed) {
        setGuestLastName("");
        setGuestFirstName("");
        setGuestMiddleName("");
        setGuestPhone("");
        setGuestEmail("");
      }
    } catch (e) {
      setErr(e?.message || "Не удалось создать бронь");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bookingPage container">
      <div className="bookingHero card">
        <div className="bookingHero__top">
          <div>
            <h1 className="bookingHero__title">Бронирование</h1>
            <p className="bookingHero__sub text-muted">
              Выберите клуб, время, услугу и свободное устройство.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <div className="bookingHero__badge">
              {selectedCity || "Город"}
              {clubName ? ` • ${clubName}` : ""}
            </div>

            {clubWorkHours && (
              <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
                График: {clubWorkHours}
              </div>
            )}
          </div>
        </div>
      </div>

      {err && <div className="bookingState bookingState--err">{err}</div>}
      {okMsg && <div className="bookingState bookingState--ok">{okMsg}</div>}

      <div className="bookingLayout">
        <section className="bookingForm card">
          {!isAuthed ? (
            <>
              <div className="bookingSectionTitle">Данные для бронирования</div>

              <div className="bookingFieldsGrid">
                <label className="field">
                  <div className="field__label">Фамилия *</div>
                  <input
                    className="field__control"
                    value={guestLastName}
                    onChange={(e) => setGuestLastName(e.target.value)}
                    placeholder="Иванов"
                  />
                </label>

                <label className="field">
                  <div className="field__label">Имя *</div>
                  <input
                    className="field__control"
                    value={guestFirstName}
                    onChange={(e) => setGuestFirstName(e.target.value)}
                    placeholder="Иван"
                  />
                </label>

                <label className="field">
                  <div className="field__label">Отчество *</div>
                  <input
                    className="field__control"
                    value={guestMiddleName}
                    onChange={(e) => setGuestMiddleName(e.target.value)}
                    placeholder="Иванович"
                  />
                </label>

                <label className="field">
                  <div className="field__label">Телефон *</div>
                  <input
                    className="field__control"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    placeholder="+79990001122"
                  />
                </label>

                <label className="field field--full">
                  <div className="field__label">Email *</div>
                  <input
                    className="field__control"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="mail@example.com"
                  />
                </label>
              </div>

              <div className="divider" />
            </>
          ) : (
            <>
              <div className="bookingProfileBox">
                <div className="bookingSectionTitle">Вы авторизованы</div>
                <div className="text-muted">
                  Данные будут автоматически взяты из вашего личного кабинета.
                </div>
              </div>

              <div className="divider" />
            </>
          )}

          <div className="bookingSectionTitle">Параметры брони</div>

          <div className="bookingFieldsGrid">
            <label className="field">
              <div className="field__label">Город *</div>
              <select
                className="field__control"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                {cities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <div className="field__label">Клуб *</div>
              <select
                className="field__control"
                value={selectedClubId || ""}
                onChange={(e) => setSelectedClubId(Number(e.target.value))}
              >
                {clubsInCity.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <div className="field__label">Дата *</div>
              <input
                className="field__control"
                type="date"
                min={tomorrowStr()}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>

            {!isWholeDayBooking && (
              <label className="field">
                <div className="field__label">Время начала *</div>
                <input
                  className="field__control"
                  type="time"
                  value={time}
                  step={3600}
                  onChange={(e) => {
                    const value = e.target.value || "";
                    const [hh = "00"] = value.split(":");
                    setTime(`${hh}:00`);
                  }}
                />
              </label>
            )}

            {!isWholeDayBooking && (
              <label className="field">
                <div className="field__label">Количество часов *</div>
                <input
                  className="field__control"
                  type="number"
                  min="1"
                  max="12"
                  value={hours}
                  onChange={(e) => setHours(Math.max(1, Number(e.target.value) || 1))}
                />
              </label>
            )}

            <label className="field">
              <div className="field__label">Услуга *</div>
              <select
                className="field__control"
                value={serviceId}
                onChange={(e) => setServiceId(String(e.target.value))}
                disabled={servicesLoading}
              >
                {!services.length && <option value="">Нет услуг</option>}
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field field--full">
              <div className="field__label">Комментарий</div>
              <textarea
                className="field__control field__control--textarea"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Например: нужен тихий зал / приду чуть раньше"
              />
            </label>
          </div>

          {!bookingFitsWorkHours && (
            <div className="bookingState bookingState--err">
              {currentClub?.work_hours
                ? `Бронирование возможно только в рабочие часы клуба: ${currentClub.work_hours}`
                : "Выбранное время не входит в рабочие часы клуба"}
            </div>
          )}

          <div className="bookingSummary bookingSummary--inline">
            <div className="bookingSummary__row">
              <span className="text-muted">Стоимость услуги</span>
              <b>{formatUnitPrice(selectedService)}</b>
            </div>

            <div className="bookingSummary__row bookingSummary__row--total">
              <span>Итого</span>
              <b>{totalText}</b>
            </div>
          </div>

          <div className="bookingSubmitRow">
            <button
              className="bookingSubmitBtn"
              onClick={handleBooking}
              disabled={!canBook || loading}
              type="button"
            >
              {loading ? "Создание..." : "Забронировать"}
            </button>
          </div>
        </section>

        <aside className="bookingSidebar card">
          <div className="bookingSidebar__head">
            <div className="bookingSectionTitle">Свободные и занятые места</div>

            <div className="bookingLegend">
              <span className="bookingLegend__item">
                <span className="bookingDot bookingDot--free" />
                Свободно
              </span>
              <span className="bookingLegend__item">
                <span className="bookingDot bookingDot--busy" />
                Занято
              </span>
            </div>
          </div>

          {requiredDeviceType && (
            <div className="bookingSidebar__hint text-muted">
              Выберите одно устройство. Занятые места недоступны.
            </div>
          )}

          {devicesLoading ? (
            <div className="devicesEmpty">Загрузка схемы мест...</div>
          ) : !requiredDeviceType ? (
            <div className="devicesEmpty">
              Для этой услуги выбор места не требуется.
            </div>
          ) : availabilityLoading ? (
            <div className="devicesEmpty">Проверяем доступность мест...</div>
          ) : (
            <div className="devicesGrid">
              {filteredDevices.map((d) => {
                const busy = busyDeviceIds.has(Number(d.id));
                const selected = selectedDeviceIds.includes(Number(d.id));

                return (
                  <button
                    key={d.id}
                    type="button"
                    disabled={busy}
                    onClick={() => toggleDevice(d.id)}
                    className={[
                      "deviceCard",
                      busy ? "deviceCard--busy" : "deviceCard--free",
                      selected ? "deviceCard--selected" : "",
                    ].join(" ")}
                  >
                    <div className="deviceCard__code">{d.code}</div>
                    <div className="deviceCard__type">
                      {d.type_name || d.type_code || "Устройство"}
                    </div>
                    <div className="deviceCard__status">
                      {busy ? "Занято" : "Свободно"}
                    </div>
                  </button>
                );
              })}

              {!filteredDevices.length && (
                <div className="devicesEmpty">
                  Для выбранной услуги пока нет подходящих устройств.
                </div>
              )}
            </div>
          )}

          <div className="bookingSummary">
            <div className="bookingSummary__row">
              <span className="text-muted">Услуга</span>
              <b>{selectedService?.name || "—"}</b>
            </div>

            <div className="bookingSummary__row">
              <span className="text-muted">Начало</span>
              <b>
                {date} {time}
              </b>
            </div>

            <div className="bookingSummary__row">
              <span className="text-muted">Окончание</span>
              <b>{endIso ? new Date(endIso).toLocaleString("ru-RU") : "—"}</b>
            </div>

            <div className="bookingSummary__row">
              <span className="text-muted">Часов</span>
              <b>{hours}</b>
            </div>

            <div className="bookingSummary__row">
              <span className="text-muted">Место</span>
              <b>
                {selectedDeviceIds.length
                  ? filteredDevices.find(
                      (d) => Number(d.id) === Number(selectedDeviceIds[0])
                    )?.code || "—"
                  : requiredDeviceType
                  ? "Не выбрано"
                  : "Не требуется"}
              </b>
            </div>

            <div className="bookingSummary__row bookingSummary__row--total">
              <span>Итого</span>
              <b>{totalText}</b>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}