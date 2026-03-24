import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { clients } from "../../api";
import "./Register.css";

function isValidEmail(email) {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidPhone(phone) {
  if (!phone) return false;
  return /^\+?[0-9]{10,15}$/.test(String(phone).trim());
}

function parseBirthDate(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(y, m - 1, d);

  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return null;
  }

  const today = new Date();
  const todayLocal = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const dtLocal = new Date(y, m - 1, d);

  if (dtLocal > todayLocal) return null;

  return dtLocal;
}

function atLeast16(valueYYYYMMDD) {
  const dt = parseBirthDate(valueYYYYMMDD);
  if (!dt) return false;

  const today = new Date();
  const todayLocal = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const limit = new Date(
    todayLocal.getFullYear() - 16,
    todayLocal.getMonth(),
    todayLocal.getDate()
  );

  return dt <= limit;
}

export default function Register() {
  const navigate = useNavigate();

  const [password, setPassword] = useState("");

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const emailNorm = useMemo(() => normalizeEmail(email), [email]);
  const emailValid = useMemo(() => isValidEmail(emailNorm), [emailNorm]);
  const phoneValid = useMemo(() => isValidPhone(phone), [phone]);
  const birthValid = useMemo(() => atLeast16(birthDate), [birthDate]);

  const canSubmit = useMemo(() => {
    if (!lastName.trim()) return false;
    if (!firstName.trim()) return false;
    if (!emailNorm || !emailValid) return false;
    if (!phone || !phoneValid) return false;
    if (!birthDate || !birthValid) return false;
    if (!password || password.length < 4) return false;
    return true;
  }, [
    lastName,
    firstName,
    emailNorm,
    emailValid,
    phone,
    phoneValid,
    birthDate,
    birthValid,
    password,
  ]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");

    if (!lastName.trim()) return setErr("Введите фамилию");
    if (!firstName.trim()) return setErr("Введите имя");
    if (!emailValid) return setErr("Неверный формат email");
    if (!phoneValid) return setErr("Телефон должен быть 10–15 цифр (можно с +)");
    if (!birthValid) return setErr("Регистрация доступна только с 16 лет");
    if (!password || password.length < 4) return setErr("Пароль минимум 4 символа");

    setLoading(true);
    try {
      const res = await clients.register({
        password,
        lastName: lastName.trim(),
        firstName: firstName.trim(),
        middleName: middleName.trim() || null,
        phone: phone.trim(),
        email: emailNorm,
        birthDate,
      });

      localStorage.setItem("clientId", String(res.userId));
      localStorage.setItem("roleId", "2");
      navigate("/account");
    } catch (e2) {
      setErr(e2?.message || "Ошибка регистрации");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container registerPage">
      <div className="card registerCard">
        <h1 className="registerTitle">Регистрация</h1>

        {err && <div className="registerState registerState--err">{err}</div>}

        <form className="registerForm" onSubmit={onSubmit}>
          <label className="field">
            <div className="field__label">Email (логин) *</div>
            <input
              className="field__control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@mail.ru"
              autoComplete="username"
            />
            {!emailValid && email.trim() && (
              <div className="field__error">Неверный формат email</div>
            )}
          </label>

          <label className="field">
            <div className="field__label">Пароль *</div>
            <input
              className="field__control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="минимум 4 символа"
              autoComplete="new-password"
            />
          </label>

          <div className="divider" />

          <label className="field">
            <div className="field__label">Фамилия *</div>
            <input
              className="field__control"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Иванов"
            />
          </label>

          <label className="field">
            <div className="field__label">Имя *</div>
            <input
              className="field__control"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Иван"
            />
          </label>

          <label className="field">
            <div className="field__label">Отчество</div>
            <input
              className="field__control"
              value={middleName}
              onChange={(e) => setMiddleName(e.target.value)}
              placeholder="Иванович"
            />
          </label>

          <label className="field">
            <div className="field__label">Телефон * (10–15 цифр)</div>
            <input
              className="field__control"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+79990001122"
            />
            {!phoneValid && phone.trim() && (
              <div className="field__error">Неверный телефон</div>
            )}
          </label>

          <label className="field">
            <div className="field__label">Дата рождения *</div>
            <input
              className="field__control"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
            {birthDate && !birthValid && (
              <div className="field__error">Должно быть 16+ лет</div>
            )}
          </label>

          <button
            className="registerBtn"
            type="submit"
            disabled={!canSubmit || loading}
          >
            {loading ? "Создаём..." : "Зарегистрироваться"}
          </button>

          <div className="registerHint text-muted">
            Уже есть аккаунт? <NavLink to="/login">Войти</NavLink>
          </div>
        </form>
      </div>
    </main>
  );
}