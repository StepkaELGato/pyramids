import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useRegion } from "../../context/useRegion.js";
import "./Header.css";

export default function Header({ onMenuClick }) {
  const { cities, selectedCity, setSelectedCity } = useRegion();
  const navigate = useNavigate();

  const [cityOpen, setCityOpen] = useState(false);
  const wrapRef = useRef(null);

  const cityLabel = useMemo(() => selectedCity || "Город", [selectedCity]);

  const clientId = localStorage.getItem("clientId") || "";
  const roleId = localStorage.getItem("roleId") || "";
  const isAuthed = Boolean(clientId);

  const isAdmin = useMemo(() => {
    return roleId === "1" || roleId === "3" || roleId === "4";
  }, [roleId]);

  const accountPath = roleId === "4" ? "/superadmin" : isAdmin ? "/admin" : "/account";

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        onMenuClick?.(false);
        setCityOpen(false);
      }
    };

    const onClickOutside = (e) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target)) setCityOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [onMenuClick]);

  const chooseCity = (city) => {
    setSelectedCity(city);
    setCityOpen(false);
  };

  const logout = () => {
    localStorage.removeItem("clientId");
    localStorage.removeItem("roleId");
    navigate("/login");
  };

  return (
    <header className="siteHeader" role="banner">
      <div className="siteHeader__inner container">
        <div className="siteHeader__left">
          <button
            type="button"
            className="siteHeader__iconBtn"
            onClick={() => onMenuClick?.(true)}
            aria-label="Открыть меню"
          >
            <span className="hamburger" aria-hidden="true" />
          </button>

          <NavLink className="siteHeader__logoLink" to="/" aria-label="На главную">
            <img src="/images/logo.png" alt="Pyramids" className="siteHeader__logoImg" />
          </NavLink>
        </div>

        <nav className="siteHeader__right" aria-label="Навигация">
          <div className="citySelect" ref={wrapRef}>
            <button
              type="button"
              className="citySelect__btn"
              aria-haspopup="listbox"
              aria-expanded={cityOpen}
              onClick={() => setCityOpen((v) => !v)}
            >
              <span className="citySelect__label">{cityLabel}</span>
              <span className={`citySelect__chev ${cityOpen ? "isOpen" : ""}`} aria-hidden="true">
                ▾
              </span>
            </button>

            {cityOpen && (
              <div className="citySelect__menu" role="listbox" aria-label="Выбор города">
                {(cities?.length ? cities : [selectedCity]).map((city) => {
                  const active = city === selectedCity;
                  return (
                    <button
                      type="button"
                      key={city}
                      className={`citySelect__item ${active ? "isActive" : ""}`}
                      role="option"
                      aria-selected={active}
                      onClick={() => chooseCity(city)}
                    >
                      {city}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <NavLink className="siteHeader__btn" to="/booking">
            Бронирование
          </NavLink>

          <NavLink className="siteHeader__btn" to="/tournaments">
            Турниры
          </NavLink>

          {!isAuthed ? (
            <NavLink className="siteHeader__btn" to="/login">
              Вход
            </NavLink>
          ) : (
            <>
              <NavLink className="siteHeader__btn" to={accountPath}>
                Личный кабинет
              </NavLink>

              <button
                type="button"
                className="siteHeader__btn"
                onClick={logout}
                style={{ cursor: "pointer" }}
              >
                Выход
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}