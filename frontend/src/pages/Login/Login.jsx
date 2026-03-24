import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { auth } from "../../api";
import "./Login.css";

export default function Login() {
  const navigate = useNavigate();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const canSubmit = useMemo(() => {
    if (!login.trim()) return false;
    if (!password) return false;
    return true;
  }, [login, password]);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      const res = await auth.login({
        login: login.trim(),
        password,
      });

      localStorage.setItem("clientId", String(res.userId));
      localStorage.setItem("roleId", String(res.roleId));

      const role = String(res.roleId);
      const isAdmin = role === "1" || role === "3" || role === "4";
      const isSuperAdmin = role === "4";

      navigate(isSuperAdmin ? "/superadmin" : isAdmin ? "/admin" : "/account");
    } catch (e2) {
      setErr(e2?.message || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container loginPage">
      <div className="card loginCard">
        <h1 className="loginTitle">Вход</h1>
        <p className="text-muted loginSub">Введите логин и пароль.</p>

        {err && <div className="loginError">{err}</div>}

        <form onSubmit={onSubmit} className="loginForm">
          <label className="field">
            <div className="field__label">Логин</div>
            <input
              className="field__control"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="client1"
              autoComplete="username"
            />
          </label>

          <label className="field">
            <div className="field__label">Пароль</div>
            <input
              className="field__control"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••"
              autoComplete="current-password"
            />
          </label>

          <button className="loginBtn" type="submit" disabled={!canSubmit || loading}>
            {loading ? "Входим..." : "Войти"}
          </button>

          <div className="text-muted loginHint">
            Нет аккаунта? <NavLink to="/register">Зарегистрироваться</NavLink>
          </div>
        </form>
      </div>
    </main>
  );
}