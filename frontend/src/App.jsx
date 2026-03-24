import { useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";

import Header from "./components/Header/Header.jsx";
import Footer from "./components/Footer/Footer.jsx";

import Home from "./pages/Home/Home.jsx";
import Services from "./pages/Services/Services.jsx";
import About from "./pages/About/About.jsx";
import Contacts from "./pages/Contacts/Contacts.jsx";
import Tournaments from "./pages/Tournaments/Tournaments.jsx";
import Booking from "./pages/Booking/Booking.jsx";

import Login from "./pages/Login/Login.jsx";
import Register from "./pages/Register/Register.jsx";
import Account from "./pages/Account/Account.jsx";
import AdminAccount from "./pages/AdminAccount/AdminAccount.jsx";
import SuperAdminAccount from "./pages/SuperAdminAccount/SuperAdminAccount.jsx";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="app">
      <Header onMenuClick={(open) => setMenuOpen(!!open)} />

      {menuOpen && (
        <div
          role="dialog"
          aria-label="Меню"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(25, 18, 12, 0.65)",
            zIndex: 60,
          }}
          onClick={closeMenu}
        >
          <div
            style={{
              width: 280,
              height: "100%",
              background:
                "linear-gradient(180deg, rgba(35,27,18,0.97), rgba(18,13,8,0.97))",
              borderRight: "1px solid var(--border)",
              padding: 20,
              position: "relative",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ position: "relative", height: 44 }}>
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                  fontWeight: 700,
                  fontSize: 18,
                }}
              >
                Меню
              </div>

              <button
                type="button"
                aria-label="Закрыть меню"
                onClick={closeMenu}
                style={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 36,
                  height: 36,
                  borderRadius: 999,
                  background: "rgba(45, 35, 22, 0.65)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  cursor: "pointer",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 22,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            <div className="hr" />

            <nav
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 10,
              }}
            >
              <NavLink className="menuLink" to="/about" onClick={closeMenu}>
                Общая информация
              </NavLink>

              <NavLink className="menuLink" to="/services" onClick={closeMenu}>
                Услуги
              </NavLink>

              <NavLink className="menuLink" to="/booking" onClick={closeMenu}>
                Бронирование
              </NavLink>

              <NavLink className="menuLink" to="/contacts" onClick={closeMenu}>
                Адрес и контакты
              </NavLink>

              <NavLink className="menuLink" to="/tournaments" onClick={closeMenu}>
                Турниры
              </NavLink>
            </nav>
          </div>
        </div>
      )}

      <main className="app__content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/services" element={<Services />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/tournaments" element={<Tournaments />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin" element={<AdminAccount />} />
          <Route path="/superadmin" element={<SuperAdminAccount />} />
        </Routes>
      </main>

      <Footer />
    </div>
  );
}