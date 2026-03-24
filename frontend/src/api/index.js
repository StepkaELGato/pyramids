const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

async function toJson(res) {
  const text = await res.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(data?.message || `HTTP ${res.status}`);
  }

  return data;
}

async function http(path, opts) {
  const res = await fetch(API_BASE + path, opts);
  return toJson(res);
}

//
// ===== AUTH =====
//
export const auth = {
  async login({ login, password }) {
    return http("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, password }),
    });
  },

  async changePassword({ userId, oldPassword, newPassword }) {
    return http("/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, oldPassword, newPassword }),
    });
  },
};

//
// ===== CLIENTS =====
//
export const clients = {
  async register({
    password,
    lastName,
    firstName,
    middleName,
    phone,
    email,
    birthDate,
  }) {
    return http("/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password,
        lastName,
        firstName,
        middleName,
        phone,
        email,
        birthDate,
      }),
    });
  },

  async get(userId) {
    return http(`/clients/${encodeURIComponent(userId)}`);
  },

  async visits(userId) {
    return http(`/clients/${encodeURIComponent(userId)}/visits`);
  },
};

//
// ===== CLUBS =====
//
export const clubs = {
  async cities() {
    return http("/clubs/cities");
  },

  async list({ city } = {}) {
    const url = new URL(API_BASE + "/clubs");
    if (city) url.searchParams.set("city", city);

    const res = await fetch(url);
    return toJson(res);
  },
};

//
// ===== SERVICES =====
//
export const services = {
  async list({ clubId } = {}) {
    const url = new URL(API_BASE + "/services");
    if (clubId) url.searchParams.set("clubId", String(clubId));

    const res = await fetch(url);
    return toJson(res);
  },
};

//
// ===== TOURNAMENTS =====
//
export const tournaments = {
  summary(clubId) {
    const qs = clubId ? `?clubId=${encodeURIComponent(clubId)}` : "";
    return http(`/tournaments/summary${qs}`);
  },
};

//
// ===== BOOKING =====
//
export const booking = {
  async meta({ clubId }) {
    const url = new URL(API_BASE + "/booking/meta");
    url.searchParams.set("clubId", String(clubId));
    const res = await fetch(url);
    return toJson(res);
  },

  async availability({ clubId, start, end }) {
    const url = new URL(API_BASE + "/booking/availability");
    url.searchParams.set("clubId", String(clubId));
    url.searchParams.set("start", start);
    url.searchParams.set("end", end);
    const res = await fetch(url);
    return toJson(res);
  },

  async create(payload) {
    return http("/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },
};

export const admin = {
  me(userId) {
    return http(`/admin/me?userId=${encodeURIComponent(userId)}`);
  },

  bookingStatuses() {
    return http("/admin/booking-statuses");
  },

  tournamentStatuses() {
    return http("/admin/tournament-statuses");
  },

  servicesDict() {
    return http("/admin/services-dict");
  },

  bookings(userId) {
    return http(`/admin/bookings?userId=${encodeURIComponent(userId)}`);
  },

  createBooking(payload) {
    return http("/admin/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  updateBooking(bookingId, payload) {
    return http(`/admin/bookings/${encodeURIComponent(bookingId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  updateBookingStatus(bookingId, payload) {
    return http(`/admin/bookings/${encodeURIComponent(bookingId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  clients(userId) {
    return http(`/admin/clients?userId=${encodeURIComponent(userId)}`);
  },

  createClient(payload) {
    return http("/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  updateClient(clientId, payload) {
    return http(`/admin/clients/${encodeURIComponent(clientId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  deleteClient(clientId, userId) {
    return http(`/admin/clients/${encodeURIComponent(clientId)}?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  },

  tournaments(userId) {
    return http(`/admin/tournaments?userId=${encodeURIComponent(userId)}`);
  },

  createTournament(payload) {
    return http("/admin/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  updateTournament(tournamentId, payload) {
    return http(`/admin/tournaments/${encodeURIComponent(tournamentId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  archiveTournament(tournamentId, userId) {
    return http(`/admin/tournaments/${encodeURIComponent(tournamentId)}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  },

  servicePrices(userId) {
    return http(`/admin/service-prices?userId=${encodeURIComponent(userId)}`);
  },

  createServicePrice(payload) {
    return http("/admin/service-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  updateServicePrice(priceId, payload) {
    return http(`/admin/service-prices/${encodeURIComponent(priceId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  archiveServicePrice(priceId, userId) {
    return http(`/admin/service-prices/${encodeURIComponent(priceId)}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
  },

  devices(userId) {
    return http(`/admin/devices?userId=${encodeURIComponent(userId)}`);
  },

  bookingAvailability({ userId, start, end }) {
    const url =
      `/admin/booking-availability?userId=${encodeURIComponent(userId)}` +
      `&start=${encodeURIComponent(start)}` +
      `&end=${encodeURIComponent(end)}`;
    return http(url);
  },

  teams(userId) {
    return http(`/admin/teams?userId=${encodeURIComponent(userId)}`);
  },

  teamClients(userId) {
    return http(`/admin/team-clients?userId=${encodeURIComponent(userId)}`);
  },

  createTeam(payload) {
    return http("/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  updateTeam(teamId, payload) {
    return http(`/admin/teams/${encodeURIComponent(teamId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  deleteTeam(teamId, userId) {
    return http(`/admin/teams/${encodeURIComponent(teamId)}?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  },

  deviceStatuses() {
    return http("/admin/device-statuses");
  },

  deviceTypes() {
    return http("/admin/device-types");
  },

  createDevice(payload) {
    return http("/admin/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  updateDevice(deviceId, payload) {
    return http(`/admin/devices/${encodeURIComponent(deviceId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  },

  deleteDevice(deviceId, userId) {
    return http(`/admin/devices/${encodeURIComponent(deviceId)}?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  },

  bookingReport({ userId, dateFrom, dateTo }) {
    const url = new URL(API_BASE + "/admin/reports/bookings");
    url.searchParams.set("userId", String(userId));
    if (dateFrom) url.searchParams.set("dateFrom", dateFrom);
    if (dateTo) url.searchParams.set("dateTo", dateTo);
    return fetch(url).then(toJson);
  },

  bookingReportExcel({ userId, dateFrom, dateTo }) {
    const url = new URL(API_BASE + "/admin/reports/bookings/export");
    url.searchParams.set("userId", String(userId));
    if (dateFrom) url.searchParams.set("dateFrom", dateFrom);
    if (dateTo) url.searchParams.set("dateTo", dateTo);

    return fetch(url).then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }
      return res.blob();
    });
  },

  

  deleteTournament(tournamentId, userId) {
    return http(`/admin/tournaments/${encodeURIComponent(tournamentId)}?userId=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    });
  },
};

export const superadmin = {
  me(userId) {
    return http(`/superadmin/me?userId=${encodeURIComponent(userId)}`);
  },

  meta(userId) {
    return http(`/superadmin/meta?userId=${encodeURIComponent(userId)}`);
  },

  items(userId, category, search = "") {
    const url = new URL(API_BASE + `/superadmin/items/${encodeURIComponent(category)}`);
    url.searchParams.set("userId", String(userId));
    if (search) url.searchParams.set("search", search);
    return fetch(url).then(toJson);
  },

  create(userId, category, payload) {
    return http(`/superadmin/items/${encodeURIComponent(category)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...payload }),
    });
  },

  update(userId, category, id, payload) {
    return http(`/superadmin/items/${encodeURIComponent(category)}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...payload }),
    });
  },

  remove(userId, category, id) {
    return http(
      `/superadmin/items/${encodeURIComponent(category)}/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`,
      { method: "DELETE" }
    );
  },

  bookingAvailability(userId, { clubId, start, end }) {
    const url =
      `/superadmin/booking-availability?userId=${encodeURIComponent(userId)}` +
      `&clubId=${encodeURIComponent(clubId)}` +
      `&start=${encodeURIComponent(start)}` +
      `&end=${encodeURIComponent(end)}`;

    return http(url);
  },
};