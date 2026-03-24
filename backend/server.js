import "dotenv/config";
import express from "express";
import cors from "cors";

import servicesRoutes from "./src/routes/services.routes.js";
import clubsRoutes from "./src/routes/clubs.routes.js";
import tournamentsRoutes from "./src/routes/tournaments.routes.js";
import bookingRoutes from "./src/routes/booking.routes.js";
import clientsRoutes from "./src/routes/clients.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import adminRoutes from "./src/routes/admin.routes.js";
import superadminRoutes from "./src/routes/superadmin.routes.js";

const app = express();

// middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

// routes
app.use("/api/services", servicesRoutes);
app.use("/api/clubs", clubsRoutes);
app.use("/api/tournaments", tournamentsRoutes);

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientsRoutes);

app.use("/api/booking", bookingRoutes);
app.use("/api/bookings", bookingRoutes);

app.use("/api/admin", adminRoutes);
app.use("/api/superadmin", superadminRoutes);

// start server
const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`Backend running on http://localhost:${port}`);
});