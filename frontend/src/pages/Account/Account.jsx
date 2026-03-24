import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, clients } from "../../api";
import "./Account.css";

function fmtDateTime(v) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleString();
}

function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return d.toLocaleDateString("ru-RU");
}

function fmtMoney(v) {
  if (v == null) return "—";
  return Number(v).toFixed(2) + " ₽";
}

export default function Account() {
  const navigate = useNavigate();
  const clientId = localStorage.getItem("clientId") || "";

  const [profile, setProfile] = useState(null);
  const [visits, setVisits] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);

  useEffect(() => {
    if (!clientId) {
      navigate("/login");
      return;
    }

    let alive = true;

    (async () => {
      setErr("");
      setLoading(true);

      try {
        const p = await clients.get(clientId);
        const v = await clients.visits(clientId);

        if (!alive) return;

        setProfile(p.client);
        setVisits(v.items || []);
      } catch (e) {
        if (!alive) return;
        setErr(e?.message || "Ошибка загрузки кабинета");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [clientId, navigate]);

  const canChangePwd = useMemo(() => {
    if (!oldPassword) return false;
    if (!newPassword || newPassword.length < 4) return false;
    if (newPassword !== newPassword2) return false;
    return true;
  }, [oldPassword, newPassword, newPassword2]);

  async function onChangePassword(e) {
    e.preventDefault();
    setPwdMsg("");
    setPwdErr("");

    if (!canChangePwd) return;

    setPwdLoading(true);
    try {
      await auth.changePassword({
        userId: clientId,
        oldPassword,
        newPassword,
      });

      setPwdMsg("Пароль изменён");
      setOldPassword("");
      setNewPassword("");
      setNewPassword2("");
    } catch (e2) {
      setPwdErr(e2?.message || "Не удалось сменить пароль");
    } finally {
      setPwdLoading(false);
    }
  }

  if (!clientId) return null;

  return (
    <main className="container accountPage">
      <h1 className="accountTitle">Личный кабинет</h1>

      {loading && <div className="text-muted">Загрузка…</div>}
      {err && <div className="accountState accountState--err">{err}</div>}

      {!loading && !err && profile && (
        <div className="accountGrid">
          <section className="card accountCard">
            <h2 className="accountH2">Личная информация</h2>

            <div className="infoRow">
              <span className="text-muted">ФИО:</span>
              <b>{profile.fullName || "—"}</b>
            </div>

            <div className="infoRow">
              <span className="text-muted">Почта:</span>
              <b>{profile.email || profile.login || "—"}</b>
            </div>

            <div className="infoRow">
              <span className="text-muted">Телефон:</span>
              <b>{profile.phone || "—"}</b>
            </div>

            <div className="infoRow">
              <span className="text-muted">Дата рождения:</span>
              <b>{fmtDate(profile.birthDate)}</b>
            </div>
          </section>

          <section className="card accountCard">
            <h2 className="accountH2">Смена пароля</h2>

            {pwdErr && <div className="accountState accountState--err">{pwdErr}</div>}
            {pwdMsg && <div className="accountState accountState--ok">{pwdMsg}</div>}

            <form className="pwdForm" onSubmit={onChangePassword}>
              <label className="field">
                <div className="field__label">Старый пароль</div>
                <input
                  className="field__control"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                />
              </label>

              <label className="field">
                <div className="field__label">Новый пароль</div>
                <input
                  className="field__control"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="минимум 4 символа"
                />
              </label>

              <label className="field">
                <div className="field__label">Повтор нового пароля</div>
                <input
                  className="field__control"
                  type="password"
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                />
              </label>

              <button
                className="accountBtn"
                type="submit"
                disabled={!canChangePwd || pwdLoading}
              >
                {pwdLoading ? "Сохраняем…" : "Сменить пароль"}
              </button>

              {newPassword && newPassword.length < 4 && (
                <div className="text-muted smallNote">
                  Пароль должен быть минимум 4 символа
                </div>
              )}

              {newPassword2 && newPassword !== newPassword2 && (
                <div className="text-muted smallNote">Пароли не совпадают</div>
              )}
            </form>
          </section>

          <section className="card accountCard accountCard--full">
            <h2 className="accountH2">История посещений</h2>

            {visits.length === 0 ? (
              <div className="text-muted">Пока нет посещений (броней).</div>
            ) : (
              <div className="tableWrap tableWrap--visits">
                <table className="accountTable">
                  <thead>
                    <tr>
                      <th>Дата/время</th>
                      <th>Клуб</th>
                      <th>Часы</th>
                      <th>Место</th>
                      <th>Итог</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map((v) => (
                      <tr key={v.booking_id}>
                        <td>
                          <div>{fmtDateTime(v.start_time)}</div>
                          <div className="text-muted smallNote">
                            до {fmtDateTime(v.end_time)}
                          </div>
                        </td>

                        <td>
                          <div>{v.club_name}</div>
                          <div className="text-muted smallNote">{v.club_city}</div>
                        </td>

                        <td>{v.hours ? Number(v.hours).toFixed(2) : "—"}</td>

                        <td>
                          {v.places ? (
                            <>
                              <div>{v.places}</div>
                              {v.places_count != null && (
                                <div className="text-muted smallNote">
                                  {v.places_count} мест(а)
                                </div>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td>{fmtMoney(v.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}