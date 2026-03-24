import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { admin } from "../../api";
import "./AdminAccount.css";

const TABS = {
  BOOKINGS: "bookings",
  CLIENTS: "clients",
  TOURNAMENTS: "tournaments",
  PRICES: "prices",
  DEVICES: "devices",
  TEAMS: "teams",
  REPORTS: "reports",
};

function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("ru-RU");
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("ru-RU");
}

function fmtMoney(v, currency = "RUB") {
  if (v == null) return "—";
  const sym = currency === "RUB" ? "₽" : currency;
  return `${Number(v).toFixed(2)} ${sym}`;
}

function serviceToDeviceType(service) {
  const name = String(service?.name || "").toLowerCase();

  if (name.includes("vr")) return "vr";
  if (name.includes("консол")) return "console";
  if (name.includes("пк")) return "pc";

  return null;
}

function normalizeHourDateTime(value) {
  if (!value) return "";

  // если пришло "2026-03-16T10:37" -> станет "2026-03-16T10:00"
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

function emptyBookingForm() {
  return {
    bookingFor: "client",

    clientId: "",
    clientEmail: "",

    guestLastName: "",
    guestFirstName: "",
    guestMiddleName: "",
    guestPhone: "",

    serviceId: "",
    deviceId: "",
    startTime: "",
    endTime: "",

    statusId: "1",
    comment: "",
  };
}

function emptyClientForm() {
  return {
    password: "",
    lastName: "",
    firstName: "",
    middleName: "",
    phone: "",
    email: "",
    birthDate: "",
  };
}

function emptyTournamentForm() {
  return {
    name: "",
    game: "",
    description: "",
    statusId: "",
    startsAt: "",
    endsAt: "",
    entryFee: "",
    prizePool: "",
    teamIds: [],
  };
}

function emptyPriceForm() {
  return {
    serviceId: "",
    pricePerHour: "",
    priceFixed: "",
    currency: "RUB",
    validFrom: "",
    validTo: "",
    isActive: true,
  };
}

export default function AdminAccount() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("clientId") || "";
  const roleId = localStorage.getItem("roleId") || "";

  const [tab, setTab] = useState(TABS.BOOKINGS);

  const [me, setMe] = useState(null);

  const [bookingStatuses, setBookingStatuses] = useState([]);
  const [tournamentStatuses, setTournamentStatuses] = useState([]);
  const [servicesDict, setServicesDict] = useState([]);

  const [bookings, setBookings] = useState([]);
  const [clients, setClients] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [prices, setPrices] = useState([]);

  const [devices, setDevices] = useState([]);
  const [busyDeviceIds, setBusyDeviceIds] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  useEffect(() => {
    if (!okMsg) return;

    const timer = setTimeout(() => {
      setOkMsg("");
    }, 10000); // 10 секунд

    return () => clearTimeout(timer);
  }, [okMsg]);

  useEffect(() => {
    if (!err) return;

    const timer = setTimeout(() => {
      setErr("");
    }, 10000);

    return () => clearTimeout(timer);
  }, [err]);


  const [bookingForm, setBookingForm] = useState(emptyBookingForm());
  const [clientForm, setClientForm] = useState(emptyClientForm());
  const [tournamentForm, setTournamentForm] = useState(emptyTournamentForm());
  const [priceForm, setPriceForm] = useState(emptyPriceForm());

  const [editingBookingId, setEditingBookingId] = useState(null);
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingTournamentId, setEditingTournamentId] = useState(null);
  const [editingPriceId, setEditingPriceId] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  // filters
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("");
  const [bookingServiceFilter, setBookingServiceFilter] = useState("");
  const [bookingDateFrom, setBookingDateFrom] = useState("");
  const [bookingDateTo, setBookingDateTo] = useState("");

  const [clientSearch, setClientSearch] = useState("");
  const [clientBirthFrom, setClientBirthFrom] = useState("");
  const [clientBirthTo, setClientBirthTo] = useState("");

  const [tournamentSearch, setTournamentSearch] = useState("");
  const [tournamentStatusFilter, setTournamentStatusFilter] = useState("");
  const [tournamentDateFrom, setTournamentDateFrom] = useState("");
  const [tournamentDateTo, setTournamentDateTo] = useState("");

  const [priceSearch, setPriceSearch] = useState("");
  const [priceActiveFilter, setPriceActiveFilter] = useState("all");

  const [teams, setTeams] = useState([]);
  const [reports, setReports] = useState([]);
  const [reportDateFrom, setReportDateFrom] = useState("");
  const [reportDateTo, setReportDateTo] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportExporting, setReportExporting] = useState(false);
  const [reportTotal, setReportTotal] = useState(null);

  const [deviceStatuses, setDeviceStatuses] = useState([]);
  const [deviceTypes, setDeviceTypes] = useState([]);
  const [devicesRefreshing, setDevicesRefreshing] = useState(false);

  const [deviceForm, setDeviceForm] = useState({
    code: "",
    typeId: "",
    statusId: "",
    notes: "",

    cpu: "",
    gpu: "",
    ramGb: "",
    storageGb: "",
    monitorHz: "",

    platform: "",
    controllers: "",
    display: "",

    model: "",
    playArea: "",
  });

  const [editingDeviceId, setEditingDeviceId] = useState(null);

  const [teamClients, setTeamClients] = useState([]);

  const [teamForm, setTeamForm] = useState({
    name: "",
    memberIds: [],
  });

  const [editingTeamId, setEditingTeamId] = useState(null);
  
  const [teamClientSearch, setTeamClientSearch] = useState("");
  const [tournamentTeamSearch, setTournamentTeamSearch] = useState("");

  const filteredTournamentTeams = useMemo(() => {
    const q = tournamentTeamSearch.trim().toLowerCase();

    return teams.filter((t) => {
      const name = String(t.name || "").toLowerCase();
      const idText = String(t.id || "");
      return !q || name.includes(q) || idText.includes(q);
    });
  }, [teams, tournamentTeamSearch]);

  const isAdminRole = useMemo(() => {
    return roleId === "1" || roleId === "3" || roleId === "4";
  }, [roleId]);

  useEffect(() => {
    if (!userId) {
      navigate("/login");
    }
  }, [userId, navigate]);

  async function loadAll() {
    if (!userId) return;

    setErr("");
    setOkMsg("");
    setLoading(true);

    try {
      const [
        meRes,
        bookingStatusesRes,
        tournamentStatusesRes,
        servicesDictRes,
        bookingsRes,
        clientsRes,
        tournamentsRes,
        pricesRes,
        teamsRes,
        teamClientsRes,
        deviceStatusesRes,
        deviceTypesRes,
      ] = await Promise.all([
        admin.me(userId),
        admin.bookingStatuses(),
        admin.tournamentStatuses(),
        admin.servicesDict(),
        admin.bookings(userId),
        admin.clients(userId),
        admin.tournaments(userId),
        admin.servicePrices(userId),
        admin.teams(userId),
        admin.teamClients(userId),
        admin.deviceStatuses(),
        admin.deviceTypes(),
      ]);

      setMe(meRes.admin || null);
      setBookingStatuses(bookingStatusesRes.items || []);
      setTournamentStatuses(tournamentStatusesRes.items || []);
      setServicesDict(servicesDictRes.items || []);
      setBookings(bookingsRes.items || []);
      setClients(clientsRes.items || []);
      setTournaments(tournamentsRes.items || []);
      setPrices(pricesRes.items || []);
      setTeams(teamsRes.items || []);
      setTeamClients(teamClientsRes.items || []);
      setDeviceStatuses(deviceStatusesRes.items || []);
      setDeviceTypes(deviceTypesRes.items || []);
    } catch (e) {
      setErr(e?.message || "Ошибка загрузки кабинета администратора");
    } finally {
      setLoading(false);
    }
  }

  async function loadDevicesList(showSuccessMessage = false) {
    if (!userId) return;

    try {
      setDevicesRefreshing(true);
      setErr("");

      const res = await admin.devices(userId);
      setDevices(Array.isArray(res?.items) ? res.items : []);

      if (showSuccessMessage) {
        setOkMsg("Список устройств обновлён");
      }
    } catch (e) {
      setErr(e?.message || "Не удалось обновить список устройств");
    } finally {
      setDevicesRefreshing(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    loadDevicesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);


  useEffect(() => {
    let alive = true;

    async function loadAvailability() {
      if (!userId || !bookingForm.startTime || !bookingForm.endTime) {
        setBusyDeviceIds([]);
        return;
      }

      try {
        setAvailabilityLoading(true);

        const res = await admin.bookingAvailability({
          userId,
          start: bookingForm.startTime,
          end: bookingForm.endTime,
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
  }, [userId, bookingForm.startTime, bookingForm.endTime]);

  useEffect(() => {
    setBookingForm((prev) => ({
      ...prev,
      deviceId: "",
    }));
  }, [bookingForm.serviceId]);

  const selectedService = useMemo(() => {
    const sid = Number(bookingForm.serviceId);
    return servicesDict.find((s) => Number(s.id) === sid) || null;
  }, [servicesDict, bookingForm.serviceId]);

  const requiredDeviceType = useMemo(() => {
    return serviceToDeviceType(selectedService);
  }, [selectedService]);

  const busySet = useMemo(() => {
    return new Set(busyDeviceIds.map(Number));
  }, [busyDeviceIds]);

  const deviceOptions = useMemo(() => {
    if (!requiredDeviceType) return [];

    return devices
      .filter((d) => String(d.type_code || "").toLowerCase() === requiredDeviceType)
      .map((d) => ({
        ...d,
        isBusy: busySet.has(Number(d.id)),
      }));
  }, [devices, busySet, requiredDeviceType]);

  const filteredBookings = useMemo(() => {
    const q = bookingSearch.trim().toLowerCase();

    return bookings.filter((b) => {
      const fullName = (b.client_full_name || b.guest_full_name || "").toLowerCase();
      const deviceText = Array.isArray(b.devices)
        ? b.devices.map((d) => `${d.code || ""} ${d.type_name || ""}`).join(" ").toLowerCase()
        : "";
      const serviceName = String(b.service_name || "").toLowerCase();
      const bookingIdText = String(b.id || "");
      const statusOk = !bookingStatusFilter || String(b.status_id) === String(bookingStatusFilter);
      const serviceOk =
        !bookingServiceFilter || String(b.service_id || "") === String(bookingServiceFilter);

      const startDate = b.start_time ? String(b.start_time).slice(0, 10) : "";
      const fromOk = !bookingDateFrom || startDate >= bookingDateFrom;
      const toOk = !bookingDateTo || startDate <= bookingDateTo;

      const searchOk =
        !q ||
        fullName.includes(q) ||
        deviceText.includes(q) ||
        serviceName.includes(q) ||
        bookingIdText.includes(q);

      return statusOk && serviceOk && fromOk && toOk && searchOk;
    });
  }, [
    bookings,
    bookingSearch,
    bookingStatusFilter,
    bookingServiceFilter,
    bookingDateFrom,
    bookingDateTo,
  ]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();

    return clients.filter((c) => {
      const fullName = String(c.full_name || "").toLowerCase();
      const phone = String(c.phone || "").toLowerCase();
      const email = String(c.email || "").toLowerCase();
      const idText = String(c.id || "");
      const birth = c.birth_date ? String(c.birth_date).slice(0, 10) : "";

      const fromOk = !clientBirthFrom || birth >= clientBirthFrom;
      const toOk = !clientBirthTo || birth <= clientBirthTo;

      const searchOk =
        !q ||
        fullName.includes(q) ||
        phone.includes(q) ||
        email.includes(q) ||
        idText.includes(q);

      return fromOk && toOk && searchOk;
    });
  }, [clients, clientSearch, clientBirthFrom, clientBirthTo]);

  const filteredTournaments = useMemo(() => {
    const q = tournamentSearch.trim().toLowerCase();

    return tournaments.filter((t) => {
      const name = String(t.name || "").toLowerCase();
      const game = String(t.game || "").toLowerCase();
      const city = String(t.city || "").toLowerCase();
      const idText = String(t.id || "");
      const startDate = t.starts_at ? String(t.starts_at).slice(0, 10) : "";

      const statusOk =
        !tournamentStatusFilter || String(t.status_id) === String(tournamentStatusFilter);
      const fromOk = !tournamentDateFrom || startDate >= tournamentDateFrom;
      const toOk = !tournamentDateTo || startDate <= tournamentDateTo;

      const teamsText = Array.isArray(t.teams)
        ? t.teams.map((x) => String(x.name || "")).join(" ").toLowerCase()
        : "";

      const searchOk =
        !q ||
        name.includes(q) ||
        game.includes(q) ||
        city.includes(q) ||
        idText.includes(q) ||
        teamsText.includes(q);
      return statusOk && fromOk && toOk && searchOk;
    });
  }, [
    tournaments,
    tournamentSearch,
    tournamentStatusFilter,
    tournamentDateFrom,
    tournamentDateTo,
  ]);

  const filteredPrices = useMemo(() => {
    const q = priceSearch.trim().toLowerCase();

    return prices.filter((p) => {
      const serviceName = String(p.service_name || "").toLowerCase();
      const idText = String(p.id || "");

      const activeOk =
        priceActiveFilter === "all" ||
        (priceActiveFilter === "active" && p.is_active) ||
        (priceActiveFilter === "archived" && !p.is_active);

      const searchOk = !q || serviceName.includes(q) || idText.includes(q);

      return activeOk && searchOk;
    });
  }, [prices, priceSearch, priceActiveFilter]);

  const filteredTeamClients = useMemo(() => {
    const q = teamClientSearch.trim().toLowerCase();

    return teamClients.filter((c) => {
      const fullName = String(c.full_name || "").toLowerCase();
      const email = String(c.email || "").toLowerCase();
      const phone = String(c.phone || "").toLowerCase();
      const userIdText = String(c.user_id || "");
      const clientIdText = String(c.client_id || "");

      return (
        !q ||
        fullName.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        userIdText.includes(q) ||
        clientIdText.includes(q)
      );
    });
  }, [teamClients, teamClientSearch]);

  const normalizedBookingEmail = useMemo(() => {
    return String(bookingForm.clientEmail || "").trim().toLowerCase();
  }, [bookingForm.clientEmail]);

  const selectedBookingClient = useMemo(() => {
    if (!normalizedBookingEmail) return null;

    return clients.find((c) => {
      const email = String(c.email || "").trim().toLowerCase();
      return email === normalizedBookingEmail;
    }) || null;
  }, [clients, normalizedBookingEmail]);

  function onBookingInput(e) {
    const { name, value } = e.target;

    setBookingForm((prev) => {
      // переключение "клиент / гость"
      if (name === "bookingFor") {
        if (value === "client") {
          return {
            ...prev,
            bookingFor: "client",
            clientId: "",
            clientEmail: "",
            guestLastName: "",
            guestFirstName: "",
            guestMiddleName: "",
            guestPhone: "",
          };
        }

        return {
          ...prev,
          bookingFor: "guest",
          clientId: "",
          clientEmail: "",
        };
      }

      // только ровные часы
      if (name === "startTime") {
        const nextStart = normalizeHourDateTime(value);

        return {
          ...prev,
          startTime: nextStart,
          endTime:
            !prev.endTime || prev.endTime <= nextStart
              ? addHoursToDateTimeLocal(nextStart, 1)
              : normalizeHourDateTime(prev.endTime),
        };
      }

      if (name === "endTime") {
        return {
          ...prev,
          endTime: normalizeHourDateTime(value),
        };
      }

      return {
        ...prev,
        [name]: value,
      };
    });
  }

  function onClientInput(e) {
    const { name, value } = e.target;
    setClientForm((s) => ({ ...s, [name]: value }));
  }

  function onTournamentInput(e) {
    const { name, value } = e.target;
    setTournamentForm((s) => ({ ...s, [name]: value }));
  }

  function onPriceInput(e) {
    const { name, value, type, checked } = e.target;
    setPriceForm((s) => ({
      ...s,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function startEditBooking(item) {
    const deviceId = item?.devices?.[0]?.id ? String(item.devices[0].id) : "";
    setEditingBookingId(item.id);
    setBookingForm({
      bookingFor: item.client_id ? "client" : "guest",

      clientId: item.client_id ? String(item.client_id) : "",
      clientEmail: item.client_email || "",

      guestLastName: item.guest_last_name || "",
      guestFirstName: item.guest_first_name || "",
      guestMiddleName: item.guest_middle_name || "",
      guestPhone: item.guest_phone || "",

      serviceId: item.service_id ? String(item.service_id) : "",
      deviceId,
      startTime: item.start_time
        ? normalizeHourDateTime(item.start_time.slice(0, 16))
        : "",
      endTime: item.end_time
        ? normalizeHourDateTime(item.end_time.slice(0, 16))
        : "",

      statusId: item.status_id ? String(item.status_id) : "1",
      comment: item.comment || "",
    });
    setTab(TABS.BOOKINGS);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetBookingForm() {
    setEditingBookingId(null);
    setBookingForm(emptyBookingForm());
  }

  function startEditClient(item) {
    setEditingClientId(item.id);
    setClientForm({
      password: "",
      lastName: item.last_name || "",
      firstName: item.first_name || "",
      middleName: item.middle_name || "",
      phone: item.phone || "",
      email: item.email || "",
      birthDate: item.birth_date ? String(item.birth_date).slice(0, 10) : "",
    });
    setTab(TABS.CLIENTS);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetClientForm() {
    setEditingClientId(null);
    setClientForm(emptyClientForm());
  }

  function startEditTournament(item) {
    setEditingTournamentId(item.id);
    setTournamentForm({
      name: item.name || "",
      game: item.game || "",
      description: item.description || "",
      statusId: item.status_id ? String(item.status_id) : "",
      startsAt: item.starts_at ? item.starts_at.slice(0, 16) : "",
      endsAt: item.ends_at ? item.ends_at.slice(0, 16) : "",
      entryFee: item.entry_fee ?? "",
      prizePool: item.prize_pool ?? "",
      teamIds: Array.isArray(item.teams) ? item.teams.map((t) => Number(t.id)) : [],
    });
    setTab(TABS.TOURNAMENTS);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetTournamentForm() {
    setEditingTournamentId(null);
    setTournamentForm(emptyTournamentForm());
  }

  function startEditPrice(item) {
    setEditingPriceId(item.id);
    setPriceForm({
      serviceId: item.service_id ? String(item.service_id) : "",
      pricePerHour: item.price_per_hour ?? "",
      priceFixed: item.price_fixed ?? "",
      currency: item.currency || "RUB",
      validFrom: item.valid_from ? String(item.valid_from).slice(0, 10) : "",
      validTo: item.valid_to ? String(item.valid_to).slice(0, 10) : "",
      isActive: Boolean(item.is_active),
    });
    setTab(TABS.PRICES);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetPriceForm() {
      setEditingPriceId(null);
      setPriceForm(emptyPriceForm());
    }

    function resetTeamForm() {
    setEditingTeamId(null);
    setTeamForm({
      name: "",
      memberIds: [],
    });
  }

  function onTeamInput(e) {
    const { name, value, options } = e.target;

    if (name === "memberIds") {
      const vals = Array.from(options)
        .filter((o) => o.selected)
        .map((o) => Number(o.value));

      setTeamForm((s) => ({
        ...s,
        memberIds: vals,
      }));
      return;
    }

    setTeamForm((s) => ({ ...s, [name]: value }));
  }

  function toggleTeamMember(userId) {
    const id = Number(userId);

    setTeamForm((prev) => {
      const exists = prev.memberIds.includes(id);

      if (exists) {
        return {
          ...prev,
          memberIds: prev.memberIds.filter((x) => x !== id),
        };
      }

      if (prev.memberIds.length >= 5) {
        return prev;
      }

      return {
        ...prev,
        memberIds: [...prev.memberIds, id],
      };
    });
  }

  function toggleTournamentTeam(teamId) {
    const id = Number(teamId);

    setTournamentForm((prev) => {
      const exists = (prev.teamIds || []).includes(id);

      if (exists) {
        return {
          ...prev,
          teamIds: prev.teamIds.filter((x) => x !== id),
        };
      }

      return {
        ...prev,
        teamIds: [...(prev.teamIds || []), id],
      };
    });
  }

  function startEditTeam(item) {
    setEditingTeamId(item.id);
    setTeamForm({
      name: item.name || "",
      memberIds: Array.isArray(item.members)
        ? item.members.map((m) => Number(m.userId))
        : [],
    });
    setTab(TABS.TEAMS);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetDeviceForm() {
    setEditingDeviceId(null);
    setDeviceForm({
      code: "",
      typeId: "",
      statusId: "",
      notes: "",

      cpu: "",
      gpu: "",
      ramGb: "",
      storageGb: "",
      monitorHz: "",

      platform: "",
      controllers: "",
      display: "",

      model: "",
      playArea: "",
    });
  }

  function onDeviceInput(e) {
    const { name, value } = e.target;
    setDeviceForm((s) => ({ ...s, [name]: value }));
  }

  function startEditDevice(item) {
    setEditingDeviceId(item.id);
    setDeviceForm({
      code: item.code || "",
      typeId: item.type_id ? String(item.type_id) : "",
      statusId: item.status_id ? String(item.status_id) : "",
      notes: item.notes || "",

      cpu: item.cpu || "",
      gpu: item.gpu || "",
      ramGb: item.ram_gb ?? "",
      storageGb: item.storage_gb ?? "",
      monitorHz: item.monitor_hz ?? "",

      platform: item.platform || "",
      controllers: item.controllers ?? "",
      display: item.display || "",

      model: item.model || "",
      playArea: item.play_area || "",
    });
    setTab(TABS.DEVICES);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function isFutureDateTimeLocal(value) {
    if (!value) return false;
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return false;
    return dt.getTime() > Date.now();
  }

  async function submitBooking(e) {
    e.preventDefault();
    setErr("");
    setOkMsg("");
    setSubmitting(true);

    if (bookingForm.bookingFor === "client" && !selectedBookingClient) {
      setErr("Клиент с таким email не найден");
      setSubmitting(false);
      return;
    }

    if (bookingForm.bookingFor === "guest") {
      if (!bookingForm.guestLastName || !bookingForm.guestFirstName || !bookingForm.guestPhone) {
        setErr("Для гостя заполните фамилию, имя и телефон");
        setSubmitting(false);
        return;
      }
    }

    if (!bookingForm.startTime || !bookingForm.endTime) {
      setErr("Выберите начало и окончание брони");
      setSubmitting(false);
      return;
    }

    if (!bookingForm.serviceId || !bookingForm.startTime || !bookingForm.endTime) {
      setErr("Заполните услугу, начало и окончание");
      setSubmitting(false);
      return;
    }

    if (new Date(bookingForm.endTime) <= new Date(bookingForm.startTime)) {
      setErr("Окончание должно быть позже начала");
      setSubmitting(false);
      return;
    }

    if (requiredDeviceType && !bookingForm.deviceId) {
      setErr("Выберите устройство для этой услуги");
      setSubmitting(false);
      return;
    }

    if (
      requiredDeviceType &&
      bookingForm.deviceId &&
      busySet.has(Number(bookingForm.deviceId)) &&
      !editingBookingId
    ) {
      setErr("Это место уже занято на выбранное время");
      setSubmitting(false);
      return;
    }

    try {
      if (editingBookingId) {
        await admin.updateBooking(editingBookingId, {
          userId,
          clientId:
            bookingForm.bookingFor === "client" && selectedBookingClient
              ? Number(selectedBookingClient.id)
              : null,
          startTime: bookingForm.startTime || null,
          endTime: bookingForm.endTime || null,
          statusId: bookingForm.statusId ? Number(bookingForm.statusId) : null,
          comment: bookingForm.comment || null,
        });
        setOkMsg("Бронь обновлена");
      } else {
        await admin.createBooking({
          userId,

          clientId:
            bookingForm.bookingFor === "client" && selectedBookingClient
              ? Number(selectedBookingClient.id)
              : null,

          guestLastName:
            bookingForm.bookingFor === "guest"
              ? bookingForm.guestLastName || null
              : null,

          guestFirstName:
            bookingForm.bookingFor === "guest"
              ? bookingForm.guestFirstName || null
              : null,

          guestMiddleName:
            bookingForm.bookingFor === "guest"
              ? bookingForm.guestMiddleName || null
              : null,

          guestPhone:
            bookingForm.bookingFor === "guest"
              ? bookingForm.guestPhone || null
              : null,

          serviceId: Number(bookingForm.serviceId),
          deviceId: requiredDeviceType ? Number(bookingForm.deviceId) : null,
          startTime: bookingForm.startTime,
          endTime: bookingForm.endTime,
          statusId: Number(bookingForm.statusId || 1),
          comment: bookingForm.comment || null,
        });
        setOkMsg("Бронь создана");
      }

      resetBookingForm();
      await loadAll();
    } catch (e2) {
      setErr(e2?.message || "Не удалось сохранить бронь");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeBookingStatus(bookingId, statusId) {
    setErr("");
    setOkMsg("");

    try {
      await admin.updateBookingStatus(bookingId, {
        userId,
        statusId: Number(statusId),
      });
      setOkMsg("Статус брони обновлён");
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Не удалось изменить статус брони");
    }
  }

  async function submitClient(e) {
    e.preventDefault();
    setErr("");
    setOkMsg("");
    setSubmitting(true);

    try {
      if (editingClientId) {
        await admin.updateClient(editingClientId, {
          userId,
          lastName: clientForm.lastName || null,
          firstName: clientForm.firstName || null,
          middleName: clientForm.middleName || null,
          phone: clientForm.phone || null,
          email: clientForm.email || null,
          birthDate: clientForm.birthDate || null,
        });
        setOkMsg("Клиент обновлён");
      } else {
        await admin.createClient({
          userId,
          password: clientForm.password,
          lastName: clientForm.lastName,
          firstName: clientForm.firstName,
          middleName: clientForm.middleName || null,
          phone: clientForm.phone,
          email: clientForm.email,
          birthDate: clientForm.birthDate,
        });
        setOkMsg("Клиент создан");
      }

      resetClientForm();
      await loadAll();
    } catch (e2) {
      setErr(e2?.message || "Не удалось сохранить клиента");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeClient(clientId) {
    const ok = window.confirm("Удалить клиента?");
    if (!ok) return;

    setErr("");
    setOkMsg("");

    try {
      await admin.deleteClient(clientId, userId);
      setOkMsg("Клиент удалён");
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Не удалось удалить клиента");
    }
  }

  async function submitTournament(e) {
    e.preventDefault();
    setErr("");
    setOkMsg("");
    setSubmitting(true);

    const selectedTournamentStatus = tournamentStatuses.find(
      (s) => String(s.id) === String(tournamentForm.statusId)
    );

    const statusName = String(selectedTournamentStatus?.name || "").toLowerCase();
    const statusCode = String(selectedTournamentStatus?.code || "").toLowerCase();

    const isCompletedStatus =
      ["completed", "done", "finished"].includes(statusCode) ||
      ["завершено", "завершён", "завершена", "завершен"].includes(statusName);

    if (
      isCompletedStatus &&
      (isFutureDateTimeLocal(tournamentForm.startsAt) ||
        isFutureDateTimeLocal(tournamentForm.endsAt))
    ) {
      setErr("Нельзя установить статус «Завершён», если дата турнира ещё в будущем");
      setSubmitting(false);
      return;
    }

    try {
      if (editingTournamentId) {
        await admin.updateTournament(editingTournamentId, {
          userId,
          name: tournamentForm.name || null,
          game: tournamentForm.game || null,
          description: tournamentForm.description || null,
          statusId: tournamentForm.statusId ? Number(tournamentForm.statusId) : null,
          startsAt: tournamentForm.startsAt || null,
          endsAt: tournamentForm.endsAt || null,
          entryFee: tournamentForm.entryFee === "" ? null : Number(tournamentForm.entryFee),
          prizePool: tournamentForm.prizePool === "" ? null : Number(tournamentForm.prizePool),
          teamIds: tournamentForm.teamIds || [],
        });
        setOkMsg("Турнир обновлён");
      } else {
        await admin.createTournament({
          userId,
          name: tournamentForm.name,
          game: tournamentForm.game || null,
          description: tournamentForm.description || null,
          statusId: Number(tournamentForm.statusId),
          startsAt: tournamentForm.startsAt || null,
          endsAt: tournamentForm.endsAt || null,
          entryFee: tournamentForm.entryFee === "" ? null : Number(tournamentForm.entryFee),
          prizePool: tournamentForm.prizePool === "" ? null : Number(tournamentForm.prizePool),
          teamIds: tournamentForm.teamIds || [],
        });
        setOkMsg("Турнир создан");
      }

      resetTournamentForm();
      await loadAll();
    } catch (e2) {
      setErr(e2?.message || "Не удалось сохранить турнир");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeTournament(tournamentId) {
    const ok = window.confirm("Удалить турнир?");
    if (!ok) return;

    setErr("");
    setOkMsg("");

    try {
      await admin.deleteTournament(tournamentId, userId);
      setOkMsg("Турнир удалён");
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Не удалось удалить турнир");
    }
  }

  async function submitPrice(e) {
    e.preventDefault();
    setErr("");
    setOkMsg("");
    setSubmitting(true);

    try {
      if (editingPriceId) {
        await admin.updateServicePrice(editingPriceId, {
          userId,
          pricePerHour: priceForm.pricePerHour === "" ? null : Number(priceForm.pricePerHour),
          priceFixed: priceForm.priceFixed === "" ? null : Number(priceForm.priceFixed),
          currency: priceForm.currency || "RUB",
          validFrom: priceForm.validFrom || null,
          validTo: priceForm.validTo || null,
          isActive: Boolean(priceForm.isActive),
        });
        setOkMsg("Цена услуги обновлена");
      } else {
        await admin.createServicePrice({
          userId,
          serviceId: Number(priceForm.serviceId),
          pricePerHour: priceForm.pricePerHour === "" ? null : Number(priceForm.pricePerHour),
          priceFixed: priceForm.priceFixed === "" ? null : Number(priceForm.priceFixed),
          currency: priceForm.currency || "RUB",
          validFrom: priceForm.validFrom,
          validTo: priceForm.validTo || null,
          isActive: Boolean(priceForm.isActive),
        });
        setOkMsg("Цена услуги добавлена");
      }

      resetPriceForm();
      await loadAll();
    } catch (e2) {
      setErr(e2?.message || "Не удалось сохранить цену услуги");
    } finally {
      setSubmitting(false);
    }
  }

  async function archivePrice(priceId) {
    const ok = window.confirm("Архивировать запись цены?");
    if (!ok) return;

    setErr("");
    setOkMsg("");

    try {
      await admin.archiveServicePrice(priceId, userId);
      setOkMsg("Цена услуги архивирована");
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Не удалось архивировать цену");
    }
  }

  async function submitTeam(e) {
    e.preventDefault();
    setErr("");
    setOkMsg("");
    setSubmitting(true);

    try {
      if (!teamForm.name.trim()) {
        setErr("Введите название команды");
        return;
      }

      if (!Array.isArray(teamForm.memberIds) || teamForm.memberIds.length !== 5) {
        setErr("В команде должно быть ровно 5 участников");
        return;
      }

      if (editingTeamId) {
        await admin.updateTeam(editingTeamId, {
          userId,
          name: teamForm.name.trim(),
          memberIds: teamForm.memberIds,
        });
        setOkMsg("Команда обновлена");
      } else {
        await admin.createTeam({
          userId,
          name: teamForm.name.trim(),
          memberIds: teamForm.memberIds,
        });
        setOkMsg("Команда создана");
      }

      resetTeamForm();
      await loadAll();
    } catch (e2) {
      setErr(e2?.message || "Не удалось сохранить команду");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeTeam(teamId) {
    const ok = window.confirm("Удалить команду?");
    if (!ok) return;

    setErr("");
    setOkMsg("");

    try {
      await admin.deleteTeam(teamId, userId);
      setOkMsg("Команда удалена");
      await loadAll();
    } catch (e) {
      setErr(e?.message || "Не удалось удалить команду");
    }
  }

  async function submitDevice(e) {
    e.preventDefault();
    setErr("");
    setOkMsg("");
    setSubmitting(true);

    try {
      if (!deviceForm.code.trim()) {
        setErr("Введите код устройства");
        return;
      }

      if (!deviceForm.typeId) {
        setErr("Выберите тип устройства");
        return;
      }

      if (!deviceForm.statusId) {
        setErr("Выберите статус устройства");
        return;
      }

      const payload = {
        userId,
        code: deviceForm.code.trim(),
        typeId: Number(deviceForm.typeId),
        statusId: Number(deviceForm.statusId),
        notes: deviceForm.notes || null,

        cpu: deviceForm.cpu || null,
        gpu: deviceForm.gpu || null,
        ramGb: deviceForm.ramGb === "" ? null : Number(deviceForm.ramGb),
        storageGb: deviceForm.storageGb === "" ? null : Number(deviceForm.storageGb),
        monitorHz: deviceForm.monitorHz === "" ? null : Number(deviceForm.monitorHz),

        platform: deviceForm.platform || null,
        controllers: deviceForm.controllers === "" ? null : Number(deviceForm.controllers),
        display: deviceForm.display || null,

        model: deviceForm.model || null,
        playArea: deviceForm.playArea || null,
      };

      if (editingDeviceId) {
        await admin.updateDevice(editingDeviceId, payload);
        setOkMsg("Устройство обновлено");
      } else {
        await admin.createDevice(payload);
        setOkMsg("Устройство создано");
      }

      resetDeviceForm();
      await loadAll();
      await loadDevicesList();
    } catch (e2) {
      setErr(e2?.message || "Не удалось сохранить устройство");
    } finally {
      setSubmitting(false);
    }
  }

  async function removeDevice(deviceId) {
    const ok = window.confirm("Удалить устройство?");
    if (!ok) return;

    setErr("");
    setOkMsg("");

    try {
      await admin.deleteDevice(deviceId, userId);
      setOkMsg("Устройство удалено");
      await loadAll();
      await loadDevicesList();
    } catch (e) {
      setErr(e?.message || "Не удалось удалить устройство");
    }
  }

  async function generateReport() {
    setErr("");
    setOkMsg("");
    setReportLoading(true);

    try {
      if (!reportDateFrom || !reportDateTo) {
        setErr("Выберите период отчёта");
        return;
      }

      const from = new Date(reportDateFrom);
      const to = new Date(reportDateTo);

      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
        setErr("Некорректный период");
        return;
      }

      if (to < from) {
        setErr("Дата окончания должна быть не раньше даты начала");
        return;
      }

      const diffDays = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
      if (diffDays < 1 || diffDays > 366) {
        setErr("Период должен быть от 1 дня до 1 года");
        return;
      }

      const res = await admin.bookingReport({
        userId,
        dateFrom: reportDateFrom,
        dateTo: reportDateTo,
      });

      setReports(res.items || []);
      setReportTotal(res.total || null);
      setOkMsg("Отчёт сформирован");
    } catch (e) {
      setErr(e?.message || "Не удалось сформировать отчёт");
    } finally {
      setReportLoading(false);
    }
  }

  async function downloadReportExcel() {
    setErr("");
    setOkMsg("");
    setReportExporting(true);

    try {
      if (!reportDateFrom || !reportDateTo) {
        setErr("Сначала выберите период отчёта");
        return;
      }

      const blob = await admin.bookingReportExcel({
        userId,
        dateFrom: reportDateFrom,
        dateTo: reportDateTo,
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `booking-profit-report-${reportDateFrom}-${reportDateTo}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setOkMsg("Отчёт выгружен");
    } catch (e) {
      setErr(e?.message || "Не удалось скачать отчёт");
    } finally {
      setReportExporting(false);
    }
  }

  if (!userId) return null;

  if (!isAdminRole && !loading && !me) {
    return (
      <main className="container adminPage">
        <h1 className="adminTitle">Кабинет администратора</h1>
        <div className="adminState adminState--err">
          У вас нет доступа к кабинету администратора клуба.
        </div>
      </main>
    );
  }

  return (
    <main className="container adminPage">
      <div className="adminHead">
        <div>
          <h1 className="adminTitle">Кабинет администратора клуба</h1>
          {me && (
            <div className="adminSub text-muted">
              {me.fullName || me.login} · {me.position || "Сотрудник"} · {me.clubName} ·{" "}
              {me.clubCity}
            </div>
          )}
        </div>
      </div>

      {loading && <div className="text-muted">Загрузка…</div>}
      {err && <div className="adminState adminState--err">{err}</div>}
      {okMsg && <div className="adminState adminState--ok">{okMsg}</div>}

      {!loading && me && (
        <>
          <div className="adminTabs">
            <button
              type="button"
              className={tab === TABS.BOOKINGS ? "adminTab adminTab--active" : "adminTab"}
              onClick={() => setTab(TABS.BOOKINGS)}
            >
              Бронирования
            </button>

            <button
              type="button"
              className={tab === TABS.CLIENTS ? "adminTab adminTab--active" : "adminTab"}
              onClick={() => setTab(TABS.CLIENTS)}
            >
              Клиенты
            </button>

            <button
              type="button"
              className={tab === TABS.TOURNAMENTS ? "adminTab adminTab--active" : "adminTab"}
              onClick={() => setTab(TABS.TOURNAMENTS)}
            >
              Турниры
            </button>

            <button
              type="button"
              className={tab === TABS.TEAMS ? "adminTab adminTab--active" : "adminTab"}
              onClick={() => setTab(TABS.TEAMS)}
            >
              Команды
            </button>

            <button
              type="button"
              className={tab === TABS.PRICES ? "adminTab adminTab--active" : "adminTab"}
              onClick={() => setTab(TABS.PRICES)}
            >
              Услуги и цены
            </button>
            <button
              type="button"
              className={tab === TABS.DEVICES ? "adminTab adminTab--active" : "adminTab"}
              onClick={() => setTab(TABS.DEVICES)}
            >
              Устройства
            </button>

            <button
              type="button"
              className={tab === TABS.REPORTS ? "adminTab adminTab--active" : "adminTab"}
              onClick={() => setTab(TABS.REPORTS)}
            >
              Отчёты
            </button>
          </div>

          {tab === TABS.BOOKINGS && (
            <div className="adminSection">
              <section className="card adminCard">
                <div className="adminCard__head">
                  <h2 className="adminH2">
                    {editingBookingId ? `Редактирование брони #${editingBookingId}` : "Создание брони"}
                  </h2>

                  {editingBookingId && (
                    <button type="button" className="adminGhostBtn" onClick={resetBookingForm}>
                      Сбросить
                    </button>
                  )}
                </div>

                <form className="adminForm adminForm--2" onSubmit={submitBooking}>
                  <label className="field">
                    <div className="field__label">Для кого бронирование</div>
                    <select
                      className="field__control"
                      name="bookingFor"
                      value={bookingForm.bookingFor}
                      onChange={onBookingInput}
                      disabled={Boolean(editingBookingId)}
                    >
                      <option value="client">Клиент</option>
                      <option value="guest">Гость</option>
                    </select>
                    {editingBookingId && (
                      <div className="text-muted smallNote">
                        При редактировании тип брони не меняем, только данные самой брони.
                      </div>
                    )}
                  </label>

                  <label className="field">
                    <div className="field__label">Статус</div>
                    <select
                      className="field__control"
                      name="statusId"
                      value={bookingForm.statusId}
                      onChange={onBookingInput}
                    >
                      {bookingStatuses.map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {bookingForm.bookingFor === "client" ? (
                    <div className="field field--full">
                      <div className="field__label">Email клиента</div>
                      <input
                        className="field__control"
                        name="clientEmail"
                        value={bookingForm.clientEmail}
                        onChange={onBookingInput}
                        placeholder="client@mail.ru"
                        autoComplete="off"
                      />

                      {!bookingForm.clientEmail.trim() ? (
                        <div className="text-muted smallNote">
                          Введите email клиента, который привязан к его аккаунту.
                        </div>
                      ) : selectedBookingClient ? (
                        <div className="text-muted smallNote">
                          Найден клиент: <b>{selectedBookingClient.full_name || "Без имени"}</b>
                          {selectedBookingClient.phone ? ` • ${selectedBookingClient.phone}` : ""}
                          {selectedBookingClient.id ? ` • ID ${selectedBookingClient.id}` : ""}
                        </div>
                      ) : (
                        <div className="accountState accountState--err">
                          Клиент с таким email не найден
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <label className="field">
                        <div className="field__label">Фамилия гостя</div>
                        <input
                          className="field__control"
                          name="guestLastName"
                          value={bookingForm.guestLastName}
                          onChange={onBookingInput}
                        />
                      </label>

                      <label className="field">
                        <div className="field__label">Имя гостя</div>
                        <input
                          className="field__control"
                          name="guestFirstName"
                          value={bookingForm.guestFirstName}
                          onChange={onBookingInput}
                        />
                      </label>

                      <label className="field">
                        <div className="field__label">Отчество гостя</div>
                        <input
                          className="field__control"
                          name="guestMiddleName"
                          value={bookingForm.guestMiddleName}
                          onChange={onBookingInput}
                        />
                      </label>

                      <label className="field">
                        <div className="field__label">Телефон гостя</div>
                        <input
                          className="field__control"
                          name="guestPhone"
                          value={bookingForm.guestPhone}
                          onChange={onBookingInput}
                        />
                      </label>
                    </>
                  )}

                  <label className="field">
                    <div className="field__label">Услуга</div>
                    <select
                      className="field__control"
                      name="serviceId"
                      value={bookingForm.serviceId}
                      onChange={onBookingInput}
                    >
                      <option value="">Выберите услугу</option>
                      {servicesDict.map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <div className="field__label">Устройство</div>

                    {!bookingForm.serviceId ? (
                      <input
                        className="field__control"
                        value=""
                        readOnly
                        placeholder="Сначала выберите услугу"
                      />
                    ) : !requiredDeviceType ? (
                      <>
                        <input
                          className="field__control"
                          value="Для этой услуги устройство не требуется"
                          readOnly
                        />
                        <div className="text-muted smallNote">
                          Эта услуга не привязана к конкретному устройству.
                        </div>
                      </>
                    ) : (
                      <>
                        <select
                          className="field__control"
                          name="deviceId"
                          value={bookingForm.deviceId}
                          onChange={onBookingInput}
                          disabled={!bookingForm.startTime || !bookingForm.endTime}
                        >
                          <option value="">
                            {!bookingForm.startTime || !bookingForm.endTime
                              ? "Сначала выберите время"
                              : "Выберите устройство"}
                          </option>

                          {deviceOptions.map((d) => (
                            <option
                              key={d.id}
                              value={d.id}
                              disabled={d.isBusy && String(d.id) !== String(bookingForm.deviceId)}
                            >
                              {d.code} · {d.type_name} · {d.isBusy ? "Занято" : "Свободно"}
                            </option>
                          ))}
                        </select>

                        <div className="text-muted smallNote">
                          {availabilityLoading
                            ? "Проверяем доступность мест..."
                            : "Занятые места недоступны для выбора на выбранный интервал"}
                        </div>
                      </>
                    )}
                  </label>

                  <label className="field">
                    <div className="field__label">Начало</div>
                    <input
                      className="field__control"
                      type="datetime-local"
                      name="startTime"
                      value={bookingForm.startTime}
                      onChange={onBookingInput}
                      step={3600}
                    />
                    <div className="text-muted smallNote">
                      Выбирайте только ровный час: 10:00, 11:00, 12:00 и т.д.
                    </div>
                  </label>

                  <label className="field">
                    <div className="field__label">Окончание</div>
                    <input
                      className="field__control"
                      type="datetime-local"
                      name="endTime"
                      value={bookingForm.endTime}
                      onChange={onBookingInput}
                      step={3600}
                    />
                    <div className="text-muted smallNote">
                      Тоже только ровный час.
                    </div>
                  </label>

                  <label className="field field--full">
                    <div className="field__label">Комментарий</div>
                    <textarea
                      className="field__control"
                      rows={3}
                      name="comment"
                      value={bookingForm.comment}
                      onChange={onBookingInput}
                    />
                  </label>

                  <div className="adminActions field--full">
                    <button className="adminBtn" type="submit" disabled={submitting}>
                      {submitting
                        ? "Сохраняем..."
                        : editingBookingId
                        ? "Обновить бронь"
                        : "Создать бронь"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="card adminCard">
                <div className="adminCard__head">
                  <h2 className="adminH2">Брони клуба</h2>
                </div>

                <div className="adminFilters adminFilters--bookings">
                  <input
                    className="field__control"
                    value={bookingSearch}
                    onChange={(e) => setBookingSearch(e.target.value)}
                    placeholder="Поиск: ID, ФИО, устройство, услуга"
                  />

                  <select
                    className="field__control"
                    value={bookingStatusFilter}
                    onChange={(e) => setBookingStatusFilter(e.target.value)}
                  >
                    <option value="">Все статусы</option>
                    {bookingStatuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <select
                    className="field__control"
                    value={bookingServiceFilter}
                    onChange={(e) => setBookingServiceFilter(e.target.value)}
                  >
                    <option value="">Все услуги</option>
                    {servicesDict.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <input
                    className="field__control"
                    type="date"
                    value={bookingDateFrom}
                    onChange={(e) => setBookingDateFrom(e.target.value)}
                  />

                  <input
                    className="field__control"
                    type="date"
                    value={bookingDateTo}
                    onChange={(e) => setBookingDateTo(e.target.value)}
                  />
                </div>

                <div className="adminTableWrap adminTableWrap--fixed">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Дата/время</th>
                        <th>Клиент/гость</th>
                        <th>Устройство</th>
                        <th>Услуга</th>
                        <th>Статус</th>
                        <th>Цена</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBookings.map((b) => (
                        <tr key={b.id}>
                          <td>{b.id}</td>
                          <td>
                            <div>{fmtDateTime(b.start_time)}</div>
                            <div className="text-muted smallNote">
                              до {fmtDateTime(b.end_time)}
                            </div>
                          </td>
                          <td>
                            <div>{b.client_full_name || b.guest_full_name || "—"}</div>
                            <div className="text-muted smallNote">
                              {b.client_email || b.guest_phone || "—"}
                            </div>
                          </td>
                          <td>
                            {Array.isArray(b.devices) && b.devices.length > 0
                              ? b.devices.map((d) => d.code).join(", ")
                              : "—"}
                          </td>
                          <td>{b.service_name || "—"}</td>
                          <td>
                            <select
                              className="adminInlineSelect"
                              value={b.status_id}
                              onChange={(e) => changeBookingStatus(b.id, e.target.value)}
                            >
                              {bookingStatuses.map((s) => (
                                <option value={s.id} key={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{fmtMoney(b.total_price)}</td>
                          <td>
                            <button
                              type="button"
                              className="adminMiniBtn"
                              onClick={() => startEditBooking(b)}
                            >
                              Изменить
                            </button>
                          </td>
                        </tr>
                      ))}
                      {!filteredBookings.length && (
                        <tr>
                          <td colSpan={8} className="text-muted">
                            Ничего не найдено
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {tab === TABS.CLIENTS && (
            <div className="adminSection">
              <section className="card adminCard">
                <div className="adminCard__head">
                  <h2 className="adminH2">
                    {editingClientId ? `Редактирование клиента #${editingClientId}` : "Добавление клиента"}
                  </h2>

                  {editingClientId && (
                    <button type="button" className="adminGhostBtn" onClick={resetClientForm}>
                      Сбросить
                    </button>
                  )}
                </div>

                <form className="adminForm adminForm--2" onSubmit={submitClient}>
                  <label className="field">
                    <div className="field__label">Email</div>
                    <input
                      className="field__control"
                      name="email"
                      value={clientForm.email}
                      onChange={onClientInput}
                    />
                  </label>

                  {!editingClientId && (
                    <label className="field">
                      <div className="field__label">Пароль</div>
                      <input
                        className="field__control"
                        type="password"
                        name="password"
                        value={clientForm.password}
                        onChange={onClientInput}
                      />
                    </label>
                  )}

                  <label className="field">
                    <div className="field__label">Фамилия</div>
                    <input
                      className="field__control"
                      name="lastName"
                      value={clientForm.lastName}
                      onChange={onClientInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Имя</div>
                    <input
                      className="field__control"
                      name="firstName"
                      value={clientForm.firstName}
                      onChange={onClientInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Отчество</div>
                    <input
                      className="field__control"
                      name="middleName"
                      value={clientForm.middleName}
                      onChange={onClientInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Телефон</div>
                    <input
                      className="field__control"
                      name="phone"
                      value={clientForm.phone}
                      onChange={onClientInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Дата рождения</div>
                    <input
                      className="field__control"
                      type="date"
                      name="birthDate"
                      value={clientForm.birthDate}
                      onChange={onClientInput}
                    />
                  </label>

                  <div className="adminActions field--full">
                    <button className="adminBtn" type="submit" disabled={submitting}>
                      {submitting
                        ? "Сохраняем..."
                        : editingClientId
                        ? "Обновить клиента"
                        : "Добавить клиента"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="card adminCard">
                <h2 className="adminH2">Клиенты клуба</h2>

                <div className="adminFilters adminFilters--clients">
                  <input
                    className="field__control"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    placeholder="Поиск: ID, ФИО, телефон, email"
                  />

                  <input
                    className="field__control"
                    type="date"
                    value={clientBirthFrom}
                    onChange={(e) => setClientBirthFrom(e.target.value)}
                  />

                  <input
                    className="field__control"
                    type="date"
                    value={clientBirthTo}
                    onChange={(e) => setClientBirthTo(e.target.value)}
                  />
                </div>

                <div className="adminTableWrap adminTableWrap--fixed">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>ФИО</th>
                        <th>Телефон</th>
                        <th>Email</th>
                        <th>Дата рождения</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.map((c) => (
                        <tr key={c.id}>
                          <td>{c.id}</td>
                          <td>{c.full_name || "—"}</td>
                          <td>{c.phone || "—"}</td>
                          <td>{c.email || "—"}</td>
                          <td>{fmtDate(c.birth_date)}</td>
                          <td>
                            <div className="adminRowBtns">
                              <button
                                type="button"
                                className="adminMiniBtn"
                                onClick={() => startEditClient(c)}
                              >
                                Изменить
                              </button>

                              <button
                                type="button"
                                className="adminMiniBtn adminMiniBtn--danger"
                                onClick={() => removeClient(c.id)}
                              >
                                Удалить
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!filteredClients.length && (
                        <tr>
                          <td colSpan={6} className="text-muted">
                            Ничего не найдено
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {tab === TABS.TOURNAMENTS && (
            <div className="adminSection">
              <section className="card adminCard">
                <div className="adminCard__head">
                  <h2 className="adminH2">
                    {editingTournamentId
                      ? `Редактирование турнира #${editingTournamentId}`
                      : "Добавление турнира"}
                  </h2>

                  {editingTournamentId && (
                    <button type="button" className="adminGhostBtn" onClick={resetTournamentForm}>
                      Сбросить
                    </button>
                  )}
                </div>

                <form className="adminForm adminForm--2" onSubmit={submitTournament}>
                  <label className="field">
                    <div className="field__label">Название</div>
                    <input
                      className="field__control"
                      name="name"
                      value={tournamentForm.name}
                      onChange={onTournamentInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Игра</div>
                    <input
                      className="field__control"
                      name="game"
                      value={tournamentForm.game}
                      onChange={onTournamentInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Статус</div>
                    <select
                      className="field__control"
                      name="statusId"
                      value={tournamentForm.statusId}
                      onChange={onTournamentInput}
                    >
                      <option value="">Выберите статус</option>
                      {tournamentStatuses.map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <div className="field__label">Начало</div>
                    <input
                      className="field__control"
                      type="datetime-local"
                      name="startsAt"
                      value={tournamentForm.startsAt}
                      onChange={onTournamentInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Окончание</div>
                    <input
                      className="field__control"
                      type="datetime-local"
                      name="endsAt"
                      value={tournamentForm.endsAt}
                      onChange={onTournamentInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Взнос</div>
                    <input
                      className="field__control"
                      name="entryFee"
                      value={tournamentForm.entryFee}
                      onChange={onTournamentInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Призовой фонд</div>
                    <input
                      className="field__control"
                      name="prizePool"
                      value={tournamentForm.prizePool}
                      onChange={onTournamentInput}
                    />
                  </label>

                  <label className="field field--full">
                    <div className="field__label">Поиск команды</div>
                    <input
                      className="field__control"
                      value={tournamentTeamSearch}
                      onChange={(e) => setTournamentTeamSearch(e.target.value)}
                      placeholder="Поиск по названию команды или ID"
                    />

                    <div className="field__label" style={{ marginTop: 10 }}>
                      Команды турнира
                    </div>

                    <div className="teamMembersList">
                      {filteredTournamentTeams.map((team) => {
                        const checked = (tournamentForm.teamIds || []).includes(Number(team.id));

                        return (
                          <label
                            key={team.id}
                            className={`teamMemberItem ${checked ? "teamMemberItem--active" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleTournamentTeam(team.id)}
                            />

                            <div className="teamMemberItem__content">
                              <div className="teamMemberItem__name">
                                {team.name || `Команда #${team.id}`}
                              </div>
                              <div className="teamMemberItem__meta text-muted">
                                ID команды: {team.id}
                              </div>
                            </div>
                          </label>
                        );
                      })}

                      {!filteredTournamentTeams.length && (
                        <div className="text-muted smallNote">Ничего не найдено</div>
                      )}
                    </div>

                    <div className="text-muted smallNote">
                      Сейчас выбрано команд: {(tournamentForm.teamIds || []).length}
                    </div>
                  </label>

                  <label className="field field--full">
                    <div className="field__label">Описание</div>
                    <textarea
                      className="field__control"
                      rows={3}
                      name="description"
                      value={tournamentForm.description}
                      onChange={onTournamentInput}
                    />
                  </label>

                  <div className="adminActions field--full">
                    <button className="adminBtn" type="submit" disabled={submitting}>
                      {submitting
                        ? "Сохраняем..."
                        : editingTournamentId
                        ? "Обновить турнир"
                        : "Добавить турнир"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="card adminCard">
                <h2 className="adminH2">Турниры клуба</h2>

                <div className="adminFilters adminFilters--tournaments">
                  <input
                    className="field__control"
                    value={tournamentSearch}
                    onChange={(e) => setTournamentSearch(e.target.value)}
                    placeholder="Поиск: ID, название, игра, город"
                  />

                  <select
                    className="field__control"
                    value={tournamentStatusFilter}
                    onChange={(e) => setTournamentStatusFilter(e.target.value)}
                  >
                    <option value="">Все статусы</option>
                    {tournamentStatuses.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>

                  <input
                    className="field__control"
                    type="date"
                    value={tournamentDateFrom}
                    onChange={(e) => setTournamentDateFrom(e.target.value)}
                  />

                  <input
                    className="field__control"
                    type="date"
                    value={tournamentDateTo}
                    onChange={(e) => setTournamentDateTo(e.target.value)}
                  />
                </div>

                <div className="adminTableWrap adminTableWrap--fixed">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Название</th>
                        <th>Игра</th>
                        <th>Статус</th>
                        <th>Начало</th>
                        <th>Окончание</th>
                        <th>Команд</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTournaments.map((t) => (
                        <tr key={t.id}>
                          <td>{t.id}</td>
                          <td>{t.name}</td>
                          <td>{t.game || "—"}</td>
                          <td>{t.status_name || "—"}</td>
                          <td>{fmtDateTime(t.starts_at)}</td>
                          <td>{fmtDateTime(t.ends_at)}</td>
                          <td>
                            <div>{t.teams_count ?? 0}</div>
                            {Array.isArray(t.teams) && t.teams.length > 0 && (
                              <div className="text-muted smallNote">
                                {t.teams.map((x) => x.name).join(", ")}
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="adminRowBtns">
                              <button
                                type="button"
                                className="adminMiniBtn"
                                onClick={() => startEditTournament(t)}
                              >
                                Изменить
                              </button>

                              <button
                                type="button"
                                className="adminMiniBtn adminMiniBtn--danger"
                                onClick={() => removeTournament(t.id)}
                              >
                                Удалить
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!filteredTournaments.length && (
                        <tr>
                          <td colSpan={8} className="text-muted"> 
                            Ничего не найдено
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {tab === TABS.PRICES && (
            <div className="adminSection">
              <section className="card adminCard">
                <div className="adminCard__head">
                  <h2 className="adminH2">
                    {editingPriceId ? `Редактирование цены #${editingPriceId}` : "Добавление цены услуги"}
                  </h2>

                  {editingPriceId && (
                    <button type="button" className="adminGhostBtn" onClick={resetPriceForm}>
                      Сбросить
                    </button>
                  )}
                </div>

                <form className="adminForm adminForm--2" onSubmit={submitPrice}>
                  <label className="field">
                    <div className="field__label">Услуга</div>
                    <select
                      className="field__control"
                      name="serviceId"
                      value={priceForm.serviceId}
                      onChange={onPriceInput}
                      disabled={Boolean(editingPriceId)}
                    >
                      <option value="">Выберите услугу</option>
                      {servicesDict.map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <div className="field__label">Цена за час</div>
                    <input
                      className="field__control"
                      name="pricePerHour"
                      value={priceForm.pricePerHour}
                      onChange={onPriceInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Фиксированная цена</div>
                    <input
                      className="field__control"
                      name="priceFixed"
                      value={priceForm.priceFixed}
                      onChange={onPriceInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Валюта</div>
                    <input
                      className="field__control"
                      name="currency"
                      value={priceForm.currency}
                      onChange={onPriceInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Действует с</div>
                    <input
                      className="field__control"
                      type="date"
                      name="validFrom"
                      value={priceForm.validFrom}
                      onChange={onPriceInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Действует до</div>
                    <input
                      className="field__control"
                      type="date"
                      name="validTo"
                      value={priceForm.validTo}
                      onChange={onPriceInput}
                    />
                  </label>

                  <label className="field fieldCheckbox">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={Boolean(priceForm.isActive)}
                      onChange={onPriceInput}
                    />
                    <span>Активная запись</span>
                  </label>

                  <div className="adminActions field--full">
                    <button className="adminBtn" type="submit" disabled={submitting}>
                      {submitting
                        ? "Сохраняем..."
                        : editingPriceId
                        ? "Обновить цену"
                        : "Добавить цену"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="card adminCard">
                <h2 className="adminH2">Услуги и цены клуба</h2>

                <div className="adminFilters adminFilters--prices">
                  <input
                    className="field__control"
                    value={priceSearch}
                    onChange={(e) => setPriceSearch(e.target.value)}
                    placeholder="Поиск: ID или название услуги"
                  />

                  <select
                    className="field__control"
                    value={priceActiveFilter}
                    onChange={(e) => setPriceActiveFilter(e.target.value)}
                  >
                    <option value="all">Все записи</option>
                    <option value="active">Только активные</option>
                    <option value="archived">Только архив</option>
                  </select>
                </div>

                <div className="adminTableWrap adminTableWrap--fixed">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Услуга</th>
                        <th>Цена/час</th>
                        <th>Фикс.</th>
                        <th>Валюта</th>
                        <th>С</th>
                        <th>До</th>
                        <th>Активна</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrices.map((p) => (
                        <tr key={p.id}>
                          <td>{p.id}</td>
                          <td>{p.service_name}</td>
                          <td>{fmtMoney(p.price_per_hour, p.currency)}</td>
                          <td>{fmtMoney(p.price_fixed, p.currency)}</td>
                          <td>{p.currency || "RUB"}</td>
                          <td>{fmtDate(p.valid_from)}</td>
                          <td>{fmtDate(p.valid_to)}</td>
                          <td>{p.is_active ? "Да" : "Нет"}</td>
                          <td>
                            <div className="adminRowBtns">
                              <button
                                type="button"
                                className="adminMiniBtn"
                                onClick={() => startEditPrice(p)}
                              >
                                Изменить
                              </button>

                              <button
                                type="button"
                                className="adminMiniBtn adminMiniBtn--danger"
                                onClick={() => archivePrice(p.id)}
                              >
                                Архивировать
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!filteredPrices.length && (
                        <tr>
                          <td colSpan={9} className="text-muted">
                            Ничего не найдено
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
          {tab === TABS.DEVICES && (
            <div className="adminSection">
              <section className="card adminCard">
                <div className="adminCard__head">
                  <h2 className="adminH2">
                    {editingDeviceId ? `Редактирование устройства #${editingDeviceId}` : "Добавление устройства"}
                  </h2>

                  {editingDeviceId && (
                    <button type="button" className="adminGhostBtn" onClick={resetDeviceForm}>
                      Сбросить
                    </button>
                  )}
                </div>

                <form className="adminForm adminForm--2" onSubmit={submitDevice}>
                  <label className="field">
                    <div className="field__label">Код устройства</div>
                    <input
                      className="field__control"
                      name="code"
                      value={deviceForm.code}
                      onChange={onDeviceInput}
                    />
                  </label>

                  <label className="field">
                    <div className="field__label">Тип устройства</div>
                    <select
                      className="field__control"
                      name="typeId"
                      value={deviceForm.typeId}
                      onChange={onDeviceInput}
                    >
                      <option value="">Выберите тип</option>
                      {deviceTypes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <div className="field__label">Статус</div>
                    <select
                      className="field__control"
                      name="statusId"
                      value={deviceForm.statusId}
                      onChange={onDeviceInput}
                    >
                      <option value="">Выберите статус</option>
                      {deviceStatuses.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <div className="field__label">Заметка</div>
                    <input
                      className="field__control"
                      name="notes"
                      value={deviceForm.notes}
                      onChange={onDeviceInput}
                    />
                  </label>

                  {String(deviceForm.typeId) === String(deviceTypes.find((x) => x.code === "pc")?.id || "") && (
                    <>
                      <label className="field"><div className="field__label">CPU</div><input className="field__control" name="cpu" value={deviceForm.cpu} onChange={onDeviceInput} /></label>
                      <label className="field"><div className="field__label">GPU</div><input className="field__control" name="gpu" value={deviceForm.gpu} onChange={onDeviceInput} /></label>
                      <label className="field"><div className="field__label">RAM (GB)</div><input className="field__control" name="ramGb" value={deviceForm.ramGb} onChange={onDeviceInput} /></label>
                      <label className="field"><div className="field__label">Storage (GB)</div><input className="field__control" name="storageGb" value={deviceForm.storageGb} onChange={onDeviceInput} /></label>
                      <label className="field"><div className="field__label">Monitor (Hz)</div><input className="field__control" name="monitorHz" value={deviceForm.monitorHz} onChange={onDeviceInput} /></label>
                    </>
                  )}

                  {String(deviceForm.typeId) === String(deviceTypes.find((x) => x.code === "console")?.id || "") && (
                    <>
                      <label className="field"><div className="field__label">Платформа</div><input className="field__control" name="platform" value={deviceForm.platform} onChange={onDeviceInput} /></label>
                      <label className="field"><div className="field__label">Контроллеров</div><input className="field__control" name="controllers" value={deviceForm.controllers} onChange={onDeviceInput} /></label>
                      <label className="field"><div className="field__label">Display</div><input className="field__control" name="display" value={deviceForm.display} onChange={onDeviceInput} /></label>
                    </>
                  )}

                  {String(deviceForm.typeId) === String(deviceTypes.find((x) => x.code === "vr")?.id || "") && (
                    <>
                      <label className="field"><div className="field__label">Модель</div><input className="field__control" name="model" value={deviceForm.model} onChange={onDeviceInput} /></label>
                      <label className="field"><div className="field__label">Игровая зона</div><input className="field__control" name="playArea" value={deviceForm.playArea} onChange={onDeviceInput} /></label>
                    </>
                  )}

                  <div className="adminActions field--full">
                    <button className="adminBtn" type="submit" disabled={submitting}>
                      {submitting
                        ? "Сохраняем..."
                        : editingDeviceId
                        ? "Обновить устройство"
                        : "Добавить устройство"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="card adminCard">
                <div className="adminCard__head">
                  <h2 className="adminH2">Устройства клуба</h2>

                  <button
                    type="button"
                    className="adminGhostBtn"
                    onClick={() => {
                      void loadDevicesList(true);
                    }}
                    disabled={devicesRefreshing}
                  >
                    {devicesRefreshing ? "Обновляем..." : "Обновить список"}
                  </button>
                </div>

                <div className="adminTableWrap adminTableWrap--fixed">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Код</th>
                        <th>Тип</th>
                        <th>Статус</th>
                        <th>Характеристики</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map((d) => (
                        <tr key={d.id}>
                          <td>{d.id}</td>
                          <td>{d.code}</td>
                          <td>{d.type_name || "—"}</td>
                          <td>{d.status_name || "—"}</td>
                          <td>
                            {d.type_code === "pc" && (
                              <div className="adminInlineList">
                                <div>CPU: {d.cpu || "—"}</div>
                                <div>GPU: {d.gpu || "—"}</div>
                                <div>RAM: {d.ram_gb ?? "—"} GB</div>
                                <div>Storage: {d.storage_gb ?? "—"} GB</div>
                                <div>Monitor: {d.monitor_hz ?? "—"} Hz</div>
                              </div>
                            )}

                            {d.type_code === "console" && (
                              <div className="adminInlineList">
                                <div>Platform: {d.platform || "—"}</div>
                                <div>Controllers: {d.controllers ?? "—"}</div>
                                <div>Display: {d.display || "—"}</div>
                              </div>
                            )}

                            {d.type_code === "vr" && (
                              <div className="adminInlineList">
                                <div>Model: {d.model || "—"}</div>
                                <div>Play area: {d.play_area || "—"}</div>
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="adminRowBtns">
                              <button
                                type="button"
                                className="adminMiniBtn"
                                onClick={() => startEditDevice(d)}
                              >
                                Изменить
                              </button>

                              <button
                                type="button"
                                className="adminMiniBtn adminMiniBtn--danger"
                                onClick={() => removeDevice(d.id)}
                              >
                                Удалить
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {!devices.length && (
                        <tr>
                          <td colSpan={6} className="text-muted">
                            Устройств пока нет
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
          {tab === TABS.TEAMS && (
            <div className="adminSection">
              <section className="card adminCard">
                <div className="adminCard__head">
                  <h2 className="adminH2">
                    {editingTeamId ? `Редактирование команды #${editingTeamId}` : "Создание команды"}
                  </h2>

                  {editingTeamId && (
                    <button type="button" className="adminGhostBtn" onClick={resetTeamForm}>
                      Сбросить
                    </button>
                  )}
                </div>

                <form className="adminForm" onSubmit={submitTeam}>
                  <label className="field">
                    <div className="field__label">Название команды</div>
                    <input
                      className="field__control"
                      name="name"
                      value={teamForm.name}
                      onChange={onTeamInput}
                      placeholder="Например: Pyramids Alpha"
                    />
                  </label>

                  <label className="field">
                    <label className="field">
                      <div className="field__label">Поиск участника</div>
                      <input
                        className="field__control"
                        value={teamClientSearch}
                        onChange={(e) => setTeamClientSearch(e.target.value)}
                        placeholder="Поиск по ФИО, email, телефону, ID"
                      />
                    </label>

                    <div className="field__label">Участники команды (ровно 5)</div>

                    <div className="teamMembersList">
                      {filteredTeamClients.map((c) => {
                        const checked = teamForm.memberIds.includes(Number(c.user_id));
                        const disabled = !checked && teamForm.memberIds.length >= 5;

                        return (
                          <label
                            key={c.user_id}
                            className={`teamMemberItem ${checked ? "teamMemberItem--active" : ""} ${disabled ? "teamMemberItem--disabled" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={disabled}
                              onChange={() => toggleTeamMember(c.user_id)}
                            />

                            <div className="teamMemberItem__content">
                              <div className="teamMemberItem__name">
                                {c.full_name || `Пользователь #${c.user_id}`}
                              </div>
                              <div className="teamMemberItem__meta text-muted">
                                {c.email || "без email"} · {c.phone || "без телефона"} · ID пользователя: {c.user_id}
                              </div>
                            </div>
                          </label>
                        );
                      })}

                      {!filteredTeamClients.length && (
                        <div className="text-muted smallNote">Ничего не найдено</div>
                      )}
                    </div>

                    <div className="text-muted smallNote">
                      Сейчас выбрано: {teamForm.memberIds.length} / 5
                    </div>
                  </label>

                  <div className="adminActions">
                    <button className="adminBtn" type="submit" disabled={submitting}>
                      {submitting
                        ? "Сохраняем..."
                        : editingTeamId
                        ? "Обновить команду"
                        : "Создать команду"}
                    </button>
                  </div>
                </form>
              </section>

              <section className="card adminCard">
                <h2 className="adminH2">Команды клуба</h2>

                <div className="adminTableWrap adminTableWrap--fixed">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Название</th>
                        <th>Участники</th>
                        <th>Создана</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map((t) => (
                        <tr key={t.id}>
                          <td>{t.id}</td>
                          <td>{t.name}</td>
                          <td>
                            {Array.isArray(t.members) && t.members.length > 0 ? (
                              <div className="adminInlineList">
                                {t.members.map((m, idx) => (
                                  <div key={`${t.id}-${m.userId}-${idx}`}>
                                    {m.fullName || `Пользователь #${m.userId}`}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{fmtDateTime(t.created_at)}</td>
                          <td>
                            <div className="adminRowBtns">
                              <button
                                type="button"
                                className="adminMiniBtn"
                                onClick={() => startEditTeam(t)}
                              >
                                Изменить
                              </button>

                              <button
                                type="button"
                                className="adminMiniBtn adminMiniBtn--danger"
                                onClick={() => removeTeam(t.id)}
                              >
                                Удалить
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {!teams.length && (
                        <tr>
                          <td colSpan={5} className="text-muted">
                            Команд пока нет
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
          {tab === TABS.REPORTS && (
            <div className="adminSection">
              <section className="card adminCard">
                <div className="adminCard__head">
                  <h2 className="adminH2">Отчёт по завершённым сеансам</h2>
                </div>

                <div className="adminFilters adminFilters--reports">
                  <input
                    className="field__control"
                    type="date"
                    value={reportDateFrom}
                    onChange={(e) => setReportDateFrom(e.target.value)}
                  />

                  <input
                    className="field__control"
                    type="date"
                    value={reportDateTo}
                    onChange={(e) => setReportDateTo(e.target.value)}
                  />

                  <button
                    type="button"
                    className="adminBtn"
                    onClick={generateReport}
                    disabled={reportLoading}
                  >
                    {reportLoading ? "Формируем..." : "Сформировать отчёт"}
                  </button>

                  <button
                    type="button"
                    className="adminGhostBtn"
                    onClick={downloadReportExcel}
                    disabled={reportExporting}
                  >
                    {reportExporting ? "Скачиваем..." : "Скачать Excel"}
                  </button>
                </div>

                {reportTotal && (
                  <div className="adminSummaryGrid">
                    <div className="adminSummaryCard">
                      <div className="text-muted">Завершённых сеансов</div>
                      <div className="adminSummaryValue">{reportTotal.bookings_count ?? 0}</div>
                    </div>

                    <div className="adminSummaryCard">
                      <div className="text-muted">Общая прибыль</div>
                      <div className="adminSummaryValue">
                        {fmtMoney(reportTotal.profit_sum || 0)}
                      </div>
                    </div>
                  </div>
                )}

                <div className="adminTableWrap adminTableWrap--fixed">
                  <table className="adminTable">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>ФИО клиента</th>
                        <th>Почта</th>
                        <th>Место</th>
                        <th>Часов</th>
                        <th>Цена</th>
                        <th>Начало</th>
                        <th>Окончание</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r) => (
                        <tr key={r.id}>
                          <td>{r.id}</td>
                          <td>{r.client_full_name || "—"}</td>
                          <td>{r.client_email || "—"}</td>
                          <td>{r.device_code || "—"}</td>
                          <td>{r.hours_count}</td>
                          <td>{fmtMoney(r.price)}</td>
                          <td>{fmtDateTime(r.start_time)}</td>
                          <td>{fmtDateTime(r.end_time)}</td>
                        </tr>
                      ))}

                      {!reports.length && (
                        <tr>
                          <td colSpan={8} className="text-muted">
                            Сформируйте отчёт за выбранный период
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </main>
  );
}