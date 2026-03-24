import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { superadmin } from "../../api";
import "./SuperAdminAccount.css";

const DEFAULT_CATEGORY = "devices";

function columnsFor(category) {
  const map = {
    devices: ["id", "code", "club_name", "type_name", "status_name", "notes"],
    clients: ["id", "full_name", "phone", "email", "birth_date", "created_at"],
    clubs: ["id", "name", "city", "address", "phone", "work_hours"],
    users: ["id", "login", "role_name", "is_active", "client_full_name", "employee_full_name"],
    employees: ["id", "last_name", "first_name", "club_name", "email", "position"],
    services: ["id", "name", "description"],
    prices: ["id", "service_name", "club_name", "price_per_hour", "price_fixed", "currency", "valid_from", "valid_to"],
    bookings: ["id", "club_name", "service_name", "status_name", "start_time", "end_time", "total_price"],
    tournaments: ["id", "club_name", "name", "game", "status_name", "starts_at", "prize_pool"],
    teams: ["id", "name", "club_name", "members", "created_at"],
  };
  return map[category] || ["id"];
}

function categoryLabels(categories) {
  return Object.fromEntries((categories || []).map((x) => [x.key, x.name]));
}

function fieldsFor(category, meta) {
  const roleOptions = (meta.roles || []).filter((role) => String(role.code) !== "guest");
  const clubOptions = meta.clubs || [];
  const serviceOptions = meta.services || [];
  const deviceTypeOptions = meta.deviceTypes || [];
  const deviceStatusOptions = meta.deviceStatuses || [];
  const bookingStatusOptions = meta.bookingStatuses || [];
  const tournamentStatusOptions = meta.tournamentStatuses || [];

  const baseClubSelect = { type: "select", options: clubOptions, valueKey: "id", labelKey: (x) => `${x.name} (${x.city})` };

  const map = {
    clubs: [
      { key: "name", label: "Название" },
      { key: "city", label: "Город" },
      { key: "address", label: "Адрес", full: true },
      { key: "phone", label: "Телефон" },
      { key: "work_hours", label: "Часы работы" },
      { key: "latitude", label: "Широта", type: "number" },
      { key: "longitude", label: "Долгота", type: "number" },
    ],
    clients: [
      { key: "email", label: "Email" },
      { key: "password", label: "Пароль" },
      { key: "last_name", label: "Фамилия" },
      { key: "first_name", label: "Имя" },
      { key: "middle_name", label: "Отчество" },
      { key: "phone", label: "Телефон" },
      { key: "birth_date", label: "Дата рождения", type: "date" },
    ],
    services: [
      { key: "name", label: "Название" },
      { key: "description", label: "Описание", type: "textarea", full: true },
    ],
    employees: [
      { key: "club_id", label: "Клуб", ...baseClubSelect },
      { key: "last_name", label: "Фамилия" },
      { key: "first_name", label: "Имя" },
      { key: "middle_name", label: "Отчество" },
      { key: "phone", label: "Телефон" },
      { key: "email", label: "Email" },
      { key: "position", label: "Должность", full: true },
    ],
    users: [
      { key: "login", label: "Логин" },
      { key: "password", label: "Пароль" },
      { key: "role_id", label: "Роль", type: "select", options: roleOptions, valueKey: "id", labelKey: "name" },
      { key: "is_active", label: "Активен", type: "checkbox" },
      { key: "client_id", label: "ID клиента", type: "number" },
      { key: "employee_id", label: "ID работника", type: "number" },
    ],
    devices: [
      { key: "club_id", label: "Клуб", ...baseClubSelect },
      { key: "type_id", label: "Тип", type: "select", options: deviceTypeOptions, valueKey: "id", labelKey: "name" },
      { key: "status_id", label: "Статус", type: "select", options: deviceStatusOptions, valueKey: "id", labelKey: "name" },
      { key: "code", label: "Код" },
      { key: "notes", label: "Заметка", type: "textarea", full: true },
      { key: "cpu", label: "CPU" },
      { key: "gpu", label: "GPU" },
      { key: "ram_gb", label: "RAM, ГБ", type: "number" },
      { key: "storage_gb", label: "SSD/HDD, ГБ", type: "number" },
      { key: "monitor_hz", label: "Монитор, Гц", type: "number" },
      { key: "platform", label: "Платформа" },
      { key: "controllers", label: "Геймпады", type: "number" },
      { key: "display", label: "Дисплей" },
      { key: "model", label: "VR модель" },
      { key: "play_area", label: "Игровая зона" },
    ],
    prices: [
      { key: "service_id", label: "Услуга", type: "select", options: serviceOptions, valueKey: "id", labelKey: "name" },
      { key: "club_id", label: "Клуб", ...baseClubSelect },
      { key: "price_per_hour", label: "Цена в час", type: "number" },
      { key: "price_fixed", label: "Фикс. цена", type: "number" },
      { key: "currency", label: "Валюта" },
      { key: "is_active", label: "Активна", type: "checkbox" },
      { key: "valid_from", label: "Действует с", type: "date" },
      { key: "valid_to", label: "Действует до", type: "date" },
    ],
    bookings: [
        { key: "booking_for", label: "Бронь для", type: "select", options: [
            { id: "client", name: "Пользователь" },
            { id: "guest", name: "Гость" },
        ], valueKey: "id", labelKey: "name" },

        { key: "club_id", label: "Клуб", ...baseClubSelect },
        { key: "service_id", label: "Услуга", type: "select", options: serviceOptions, valueKey: "id", labelKey: "name" },
        { key: "status_id", label: "Статус", type: "select", options: bookingStatusOptions, valueKey: "id", labelKey: "name" },

        { key: "client_id", label: "ID клиента", type: "number" },

        { key: "guest_last_name", label: "Фамилия гостя" },
        { key: "guest_first_name", label: "Имя гостя" },
        { key: "guest_middle_name", label: "Отчество гостя" },
        { key: "guest_phone", label: "Телефон гостя" },
        { key: "guest_email", label: "Email гостя" },

        { key: "start_time", label: "Начало", type: "datetime-local" },
        { key: "end_time", label: "Конец", type: "datetime-local" },
        { key: "total_price", label: "Сумма", type: "number" },
        { key: "comment", label: "Комментарий", type: "textarea", full: true },
    ],
    tournaments: [
      { key: "club_id", label: "Клуб", ...baseClubSelect },
      { key: "name", label: "Название" },
      { key: "game", label: "Игра" },
      { key: "status_id", label: "Статус", type: "select", options: tournamentStatusOptions, valueKey: "id", labelKey: "name" },
      { key: "starts_at", label: "Начало", type: "datetime-local" },
      { key: "ends_at", label: "Конец", type: "datetime-local" },
      { key: "entry_fee", label: "Взнос", type: "number" },
      { key: "prize_pool", label: "Призовой фонд", type: "number" },
      { key: "team_ids", label: "ID команд через запятую", full: true },
      { key: "description", label: "Описание", type: "textarea", full: true },
    ],
    teams: [
      { key: "club_id", label: "Клуб", ...baseClubSelect },
      { key: "name", label: "Название" },
    ],
  };

  return map[category] || [];
}

function emptyForm(category) {
  const fields = {
    clubs: { name: "", city: "", address: "", phone: "", work_hours: "", latitude: "", longitude: "" },
    services: { name: "", description: "" },
    employees: { club_id: "", last_name: "", first_name: "", middle_name: "", phone: "", email: "", position: "" },
    users: { login: "", password: "", role_id: "", is_active: true, client_id: "", employee_id: "" },
    devices: {
      club_id: "",
      type_id: "",
      status_id: "",
      code: "",
      notes: "",
      cpu: "",
      gpu: "",
      ram_gb: "",
      storage_gb: "",
      monitor_hz: "",
      platform: "",
      controllers: "",
      display: "",
      model: "",
      play_area: "",
    },
    clients: {
      email: "",
      password: "",
      last_name: "",
      first_name: "",
      middle_name: "",
      phone: "",
      birth_date: "",
    },
    prices: {
      service_id: "",
      club_id: "",
      price_per_hour: "",
      price_fixed: "",
      currency: "RUB",
      is_active: true,
      valid_from: "",
      valid_to: "",
    },
    bookings: {
      booking_for: "client",
      club_id: "",
      client_id: "",
      service_id: "",
      status_id: "",
      guest_last_name: "",
      guest_first_name: "",
      guest_middle_name: "",
      guest_phone: "",
      guest_email: "",
      start_time: "",
      end_time: "",
      total_price: "",
      comment: "",
    },
    tournaments: { club_id: "", name: "", game: "", status_id: "", starts_at: "", ends_at: "", entry_fee: "", prize_pool: "", team_ids: "", description: "" },
    teams: { club_id: "", name: "", memberIds: [] },
  };
  return fields[category] ? { ...fields[category] } : {};
}

function valueFromRow(category, row) {
  const next = { ...emptyForm(category) };
  Object.keys(next).forEach((key) => {
    if (key === "booking_for") {
        next[key] = row?.client_id ? "client" : "guest";
    } else if (key === "team_ids") {
      next[key] = Array.isArray(row?.teams) ? row.teams.map((x) => x.id).join(", ") : "";
    } else if (key === "memberIds") {
        next[key] = Array.isArray(row?.members)
            ? row.members.map((x) => Number(x.userId))
            : [];
    } else if (key === "device_id") {
      next[key] = Array.isArray(row?.devices) && row.devices.length ? String(row.devices[0].id || "") : "";
    } else if (row && row[key] != null) {
      next[key] = row[key];
    }
  });
  return next;
}

function normalizePayload(category, form) {
  const payload = { ...form };
  if (category === "teams") {
    payload.member_ids = Array.isArray(form.memberIds)
        ? form.memberIds.map(Number).filter(Boolean)
        : [];
    }
  if (category === "tournaments") {
    payload.team_ids = String(form.team_ids || "")
      .split(",")
      .map((x) => Number(x.trim()))
      .filter(Boolean);
  }
  if (category === "bookings") {
    if (form.booking_for === "client") {
        payload.guest_last_name = "";
        payload.guest_first_name = "";
        payload.guest_middle_name = "";
        payload.guest_phone = "";
        payload.guest_email = "";
    } else if (form.booking_for === "guest") {
        payload.client_id = "";
    }

    delete payload.booking_for;
  }
  if (category === "clients") {
    payload.email = String(form.email || "").trim().toLowerCase();
    payload.last_name = String(form.last_name || "").trim();
    payload.first_name = String(form.first_name || "").trim();
    payload.middle_name = String(form.middle_name || "").trim() || null;
    payload.phone = String(form.phone || "").trim();
    payload.birth_date = form.birth_date || null;

    if (!String(form.password || "").trim()) {
      delete payload.password;
    }
  }
  return payload;
}

function normalizeHourDateTime(value) {
  if (!value) return "";

  const [datePart, timePart = ""] = String(value).split("T");
  const [hh = "00"] = timePart.split(":");

  return `${datePart}T${hh.padStart(2, "0")}:00`;
}

function addHoursToDateTimeLocal(value, hoursToAdd = 1) {
  if (!value) return "";

  const normalized = normalizeHourDateTime(value);
  const [datePart, timePart] = normalized.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);

  const dt = new Date(y, m - 1, d, hh, mm || 0, 0, 0);
  dt.setHours(dt.getHours() + Number(hoursToAdd || 1));

  const yyyy = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  const hour = String(dt.getHours()).padStart(2, "0");

  return `${yyyy}-${month}-${day}T${hour}:00`;
}

function renderTableCell(category, col, value) {
  if (value == null || value === "") return "—";

  if (category === "teams" && col === "members") {
    if (!Array.isArray(value) || !value.length) return "—";

    return (
      <div className="superMembersList">
        {value.map((member, index) => (
          <div key={member.userId || index} className="superMembersItem">
            <div className="superMembersName">
              {member.fullName || "Без имени"}
            </div>
            <div className="superMembersMeta">
              ID: {member.userId || "—"} · {member.login || "—"}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (Array.isArray(value)) {
    return <code>{JSON.stringify(value, null, 2)}</code>;
  }

  if (typeof value === "object") {
    return <code>{JSON.stringify(value, null, 2)}</code>;
  }

  if (typeof value === "boolean") {
    return value ? "Да" : "Нет";
  }

  return String(value);
}

export default function SuperAdminAccount() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("clientId") || "";
  const roleId = localStorage.getItem("roleId") || "";

  const [meta, setMeta] = useState({ categories: [] });
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm(DEFAULT_CATEGORY));
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [devices, setDevices] = useState([]);
  const [busyDeviceIds, setBusyDeviceIds] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [teamClients, setTeamClients] = useState([]);
    const [teamClientSearch, setTeamClientSearch] = useState("");

  useEffect(() => {
    if (!userId) {
      navigate("/login");
      return;
    }
    if (String(roleId) !== "4") {
      navigate("/admin");
    }
  }, [navigate, roleId, userId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [metaRes] = await Promise.all([superadmin.meta(userId)]);
        if (!alive) return;
        setMeta(metaRes || { categories: [] });
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Не удалось загрузить данные суперадмина");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  async function loadItems(nextCategory = category, nextSearch = search) {
    setErr("");
    const res = await superadmin.items(userId, nextCategory, nextSearch);
    setItems(Array.isArray(res?.items) ? res.items : []);
  }

  useEffect(() => {
    if (category !== "bookings" || !form.club_id) {
        setDevices([]);
        return;
    }

    superadmin.items(userId, "devices")
        .then((res) => {
        const all = Array.isArray(res?.items) ? res.items : [];

        // фильтр по клубу
        const filtered = all.filter(
            (d) => String(d.club_id) === String(form.club_id)
        );

        setDevices(filtered);
        })
        .catch(() => setDevices([]));

    }, [category, form.club_id, userId]);

  useEffect(() => {
    if (!userId || String(roleId) !== "4") return;
    setForm(emptyForm(category));
    setEditingId(null);
    loadItems(category, search).catch((e) => setErr(e?.message || "Не удалось загрузить список"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, userId, roleId]);

  useEffect(() => {
    if (category !== "teams") {
        setTeamClients([]);
        return;
    }

    superadmin.items(userId, "users")
        .then((res) => {
        const all = Array.isArray(res?.items) ? res.items : [];

        // Только активные клиенты
        const filtered = all.filter(
            (u) =>
            String(u.role_name || "").toLowerCase().includes("клиент") &&
            u.is_active
        );

        setTeamClients(filtered);
        })
        .catch(() => setTeamClients([]));
    }, [category, userId]);

  useEffect(() => {
    let alive = true;

    async function loadAvailability() {
        if (
        category !== "bookings" ||
        !form.club_id ||
        !form.start_time ||
        !form.end_time
        ) {
        setBusyDeviceIds([]);
        return;
        }

        try {
        setAvailabilityLoading(true);

        const res = await superadmin.bookingAvailability(userId, {
            clubId: form.club_id,
            start: form.start_time,
            end: form.end_time,
        });

        if (!alive) return;
        setBusyDeviceIds(Array.isArray(res?.busyDeviceIds) ? res.busyDeviceIds : []);
        } catch {
        if (!alive) return;
        setBusyDeviceIds([]);
        } finally {
        if (alive) setAvailabilityLoading(false);
        }
    }

    loadAvailability();

    return () => {
        alive = false;
    };
  }, [category, form.club_id, form.start_time, form.end_time, userId]);

  const labels = useMemo(() => categoryLabels(meta.categories), [meta.categories]);
  const fields = useMemo(() => fieldsFor(category, meta), [category, meta]);
  const cols = useMemo(() => columnsFor(category), [category]);

  const selectedDeviceTypeCode = useMemo(() => {
  if (category !== "devices") return null;

  const selectedType = (meta.deviceTypes || []).find(
    (x) => String(x.id) === String(form.type_id || form.typeId || "")
  );

  return String(selectedType?.code || "").toLowerCase() || null;
    }, [category, meta.deviceTypes, form.type_id, form.typeId]);

    const selectedService = useMemo(() => {
    if (category !== "bookings") return null;
    const sid = Number(form.service_id);
    return (meta.services || []).find((s) => Number(s.id) === sid) || null;
    }, [category, meta.services, form.service_id]);

    function serviceToDeviceType(service) {
    const name = String(service?.name || "").toLowerCase();
    const code = String(service?.code || "").toLowerCase();

    if (code === "vr" || name.includes("vr")) return "vr";
    if (code === "console" || code === "con" || name.includes("консол")) return "console";
    if (code === "pc" || name.includes("пк")) return "pc";

    return null;
    }

    const requiredBookingDeviceType = useMemo(() => {
    if (category !== "bookings") return null;
    return serviceToDeviceType(selectedService);
    }, [category, selectedService]);

    const availableDevices = useMemo(() => {
    if (!devices.length) return [];

    return devices.filter((d) => {
        if (!requiredBookingDeviceType) return true;
        return d.type_code === requiredBookingDeviceType;
    });
    }, [devices, requiredBookingDeviceType]);

    const filteredTeamClients = useMemo(() => {
    const q = teamClientSearch.trim().toLowerCase();

    return teamClients.filter((c) => {
        const fullName = String(
        c.client_full_name || c.full_name || ""
        ).toLowerCase();
        const email = String(c.login || "").toLowerCase();
        const idText = String(c.id || c.user_id || "");

        return !q || fullName.includes(q) || email.includes(q) || idText.includes(q);
    });
    }, [teamClients, teamClientSearch]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm(category));
  }

  function startEdit(row) {
    setEditingId(row.id);
    setForm(valueFromRow(category, row));
  }

  function toggleTeamMember(userId) {
    const id = Number(userId);

    setForm((prev) => {
        const current = Array.isArray(prev.memberIds) ? prev.memberIds : [];
        const exists = current.includes(id);

        if (exists) {
        return {
            ...prev,
            memberIds: current.filter((x) => x !== id),
        };
        }

        if (current.length >= 5) {
        return prev;
        }

        return {
        ...prev,
        memberIds: [...current, id],
        };
    });
    }

  async function onSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    setOkMsg("");

    try {
        if (category === "teams" && (form.memberIds || []).length !== 5) {
            setErr("В команде должно быть ровно 5 участников");
            setSaving(false);
            return;
        }
      const payload = normalizePayload(category, form);
      if (editingId) {
        await superadmin.update(userId, category, editingId, payload);
        setOkMsg("Изменения сохранены");
      } else {
        await superadmin.create(userId, category, payload);
        setOkMsg("Объект создан");
      }
      await loadItems(category, search);
      startCreate();
    } catch (e2) {
      setErr(e2?.message || "Не удалось сохранить объект");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id) {
    const ok = window.confirm("Удалить объект? Это действие нельзя быстро отменить.");
    if (!ok) return;
    try {
      setErr("");
      setOkMsg("");
      await superadmin.remove(userId, category, id);
      setOkMsg("Объект удалён");
      await loadItems(category, search);
      if (editingId === id) startCreate();
    } catch (e) {
      setErr(e?.message || "Не удалось удалить объект");
    }
  }

  if (!userId || String(roleId) !== "4") return null;

  return (
    <main className="container superPage">
      <div className="superHead">
        <h1 className="superTitle">Суперадмин</h1>
        <div className="superSub">
          Полный доступ ко всей базе. Выбери категорию, найди объект, измени или создай новый.
        </div>
      </div>

      {err && <div className="superState superState--err">{err}</div>}
      {okMsg && <div className="superState superState--ok">{okMsg}</div>}

      <div className="superStack">
        <section className="card superCategories">
            <h2 className="adminH2">Категория</h2>
            <div className="superCategories__grid">
            {(meta.categories || []).map((cat) => (
                <button
                key={cat.key}
                type="button"
                className={`superChip ${category === cat.key ? "superChip--active" : ""}`}
                onClick={() => setCategory(cat.key)}
                >
                {cat.name}
                </button>
            ))}
            </div>
        </section>

        <section className="card superLayoutCard">
            <div className="adminCard__head">
            <h2 className="adminH2">
                {editingId ? `Редактирование #${editingId}` : `Создание: ${labels[category] || category}`}
            </h2>
            </div>

            <form className="superForm" onSubmit={onSubmit}>
            <div className="superFormGrid">

            {fields
                .filter((field) => {
                    if (category === "devices") {
                    const base = ["club_id", "type_id", "status_id", "code", "notes"];
                    if (base.includes(field.key)) return true;

                    if (selectedDeviceTypeCode === "pc") {
                        return ["cpu", "gpu", "ram_gb", "storage_gb", "monitor_hz"].includes(field.key);
                    }

                    if (selectedDeviceTypeCode === "console") {
                        return ["platform", "controllers", "display"].includes(field.key);
                    }

                    if (selectedDeviceTypeCode === "vr") {
                        return ["model", "play_area"].includes(field.key);
                    }

                    return false;
                    }

                    if (category === "bookings") {
                    const base = [
                      "booking_for",
                      "club_id",
                      "service_id",
                      "status_id",
                      "start_time",
                      "end_time",
                      "total_price",
                      "comment",
                    ];

                    if (base.includes(field.key)) return true;

                    if ((form.booking_for || "client") === "client") {
                        return field.key === "client_id";
                    }

                    if (category === "clients" && editingId && field.key === "password") {
                      return false;
                    }

                    if ((form.booking_for || "client") === "guest") {
                        return [
                        "guest_last_name",
                        "guest_first_name",
                        "guest_middle_name",
                        "guest_phone",
                        "guest_email",
                        ].includes(field.key);
                    }

                    return false;
                    }

                    return true;
                })
                .map((field) => {
                const key = field.key;
                const value = form[key] ?? "";
                const labelGetter =
                    typeof field.labelKey === "function"
                    ? field.labelKey
                    : (x) => x?.[field.labelKey || "name"];

                return (
                    <label key={key} className={`field ${field.full ? "superField--full" : ""}`}>
                    <div className="field__label">{field.label}</div>

                    {field.type === "textarea" ? (
                        <textarea
                        className="field__control"
                        rows={4}
                        value={value}
                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        />
                    ) : field.type === "checkbox" ? (
                        <label className="superCheck">
                            <input
                            className="superCheck__input"
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.checked }))}
                            />
                            <span className="superCheck__box" />
                            <span className="superCheck__text">
                            {value ? "Да" : "Нет"}
                            </span>
                        </label>
                    ) : field.type === "select" ? (
                        <select
                        className="field__control"
                        value={value}
                        onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                        >
                        <option value="">— выбрать —</option>
                        {(field.options || []).map((opt) => (
                            <option
                            key={opt[field.valueKey || "id"]}
                            value={opt[field.valueKey || "id"]}
                            >
                            {labelGetter(opt)}
                            </option>
                        ))}
                        </select>
                    ) : (
                        <input
                        className="field__control"
                        type={field.type || "text"}
                        value={value}
                        step={field.type === "datetime-local" ? 3600 : undefined}
                        onChange={(e) => {
                            const nextValue =
                            category === "bookings" && field.type === "datetime-local"
                                ? normalizeHourDateTime(e.target.value)
                                : e.target.value;

                            setForm((prev) => {
                            const next = { ...prev, [key]: nextValue };

                            if (category === "bookings" && key === "start_time") {
                                next.end_time = addHoursToDateTimeLocal(nextValue, 1);
                            }

                            return next;
                            });
                        }}
                        />
                    )}
                    </label>
                );
                })}
            </div>
            
            {category === "bookings" && form.club_id && (
            <div className="card" style={{ padding: 12 }}>
                <div className="field__label">Устройство</div>

                {availabilityLoading && (
                <div className="superHint">Проверяем доступность...</div>
                )}

                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {availableDevices.map((device) => {
                    const busy = busyDeviceIds.includes(device.id);

                    return (
                    <button
                        key={device.id}
                        type="button"
                        className={`superChip ${form.device_id == device.id ? "superChip--active" : ""}`}
                        disabled={busy}
                        onClick={() =>
                        setForm((prev) => ({
                            ...prev,
                            device_id: device.id,
                        }))
                        }
                        style={{
                        opacity: busy ? 0.5 : 1,
                        borderColor: busy ? "rgba(255,84,84,0.4)" : undefined,
                        }}
                    >
                        {device.code} ({device.type_name})
                        <div style={{ fontSize: 12 }}>
                        {busy ? "Занято" : "Свободно"}
                        </div>
                    </button>
                    );
                })}
                </div>
            </div>
            )}

            {category === "teams" && (
            <div className="field">
                <div className="field__label">Поиск участника</div>

                <input
                className="field__control"
                value={teamClientSearch}
                onChange={(e) => setTeamClientSearch(e.target.value)}
                placeholder="Поиск по имени, логину, ID"
                />

                <div className="field__label" style={{ marginTop: 12 }}>
                Участники команды (ровно 5)
                </div>

                <div className="superMembersPicker">
                {filteredTeamClients.map((c) => {
                    const uid = Number(c.id || c.user_id);
                    const checked = (form.memberIds || []).includes(uid);
                    const disabled = !checked && (form.memberIds || []).length >= 5;

                    return (
                    <label
                        key={uid}
                        className={`superMemberPickItem ${checked ? "superMemberPickItem--active" : ""} ${disabled ? "superMemberPickItem--disabled" : ""}`}
                    >
                        <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleTeamMember(uid)}
                        />

                        <div className="superMemberPickItem__content">
                        <div className="superMemberPickItem__name">
                            {c.client_full_name || c.full_name || `Пользователь #${uid}`}
                        </div>
                        <div className="superMemberPickItem__meta">
                            {c.login || "без логина"} · ID пользователя: {uid}
                        </div>
                        </div>
                    </label>
                    );
                })}

                {!filteredTeamClients.length && (
                    <div className="text-muted">Ничего не найдено</div>
                )}
                </div>

                <div className="superHint">
                Сейчас выбрано: {(form.memberIds || []).length} / 5
                </div>
            </div>
            )}

            <div className="superActions">
                <button className="superBtn" type="submit" disabled={saving || loading}>
                {saving ? "Сохраняем..." : editingId ? "Сохранить" : "Создать"}
                </button>
                {editingId && (
                <button className="superBtn" type="button" onClick={startCreate}>
                    Отменить редактирование
                </button>
                )}
            </div>
            </form>
        </section>

        <section className="card superSearchCard">
            <h2 className="adminH2">Поиск и список</h2>
            <div className="superSearchRow">
            <input
                className="field__control"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Поиск по категории «${labels[category] || category}»`}
            />
            <button className="superBtn" type="button" onClick={() => loadItems(category, search)}>
                Найти
            </button>
            <button className="superBtn" type="button" onClick={startCreate}>
                Новый объект
            </button>
            </div>
            <div className="superHint">
            Можно искать по названию, имени, логину, коду, адресу и другим основным полям.
            </div>
        </section>

        <section className="card superLayoutCard">
            <div className="adminCard__head">
            <h2 className="adminH2">Объекты категории</h2>
            <div className="text-muted">{loading ? "Загрузка..." : `${items.length} шт.`}</div>
            </div>

            <div className="superTableWrap">
            <table className="superTable">
                <thead>
                <tr>
                    {cols.map((col) => (
                    <th key={col}>{col}</th>
                    ))}
                    <th>Действия</th>
                </tr>
                </thead>
                <tbody>
                {items.map((row) => (
                    <tr key={row.id}>
                    {cols.map((col) => (
                        <td key={`${row.id}-${col}`}>
                        {renderTableCell(category, col, row[col])}
                        </td>
                    ))}
                    <td>
                        <div className="adminRowBtns">
                        <button type="button" className="superMiniBtn" onClick={() => startEdit(row)}>
                            Изменить
                        </button>
                        <button
                            type="button"
                            className="superMiniBtn superMiniBtn--danger"
                            onClick={() => onDelete(row.id)}
                        >
                            Удалить
                        </button>
                        </div>
                    </td>
                    </tr>
                ))}
                {!items.length && !loading && (
                    <tr>
                    <td colSpan={cols.length + 1} className="text-muted">
                        По этому запросу ничего не найдено.
                    </td>
                    </tr>
                )}
                </tbody>
            </table>
            </div>
        </section>
        </div>
    </main>
  );
}
