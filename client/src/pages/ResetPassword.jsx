import { ArrowLeft, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/api";
import eyeOffIcon from "../assets/eye-off-grey.svg";
import eyeIcon from "../assets/eye-grey.svg";

export default function ResetPassword() {
  const { token } = useParams();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const { data } = await api.post(`/auth/reset-password/${token}`, {
        password,
      });
      setMessage(data.message);
      setPassword("");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Не вдалося змінити пароль",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-shell compact-auth">
        <div className="auth-panel register-panel">
          <div className="brand-mark">F</div>
          <span className="eyebrow">Новий пароль</span>
          <h1>Захистіть свій фінансовий простір</h1>
          <p>Створіть новий пароль і поверніться до планування бюджету</p>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="form-heading">
            <span>Доступ</span>
            <h2>Встановити пароль</h2>
          </div>

          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-success">{message}</p> : null}

          <label className="field">
            <span>Новий пароль</span>
            <div className="input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                autoComplete="new-password"
                minLength={12}
                onChange={(event) => setPassword(event.target.value)}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}"
                placeholder="Мінімум 12 символів"
                required
                title="Пароль має містити велику й малу літеру, цифру та спецсимвол"
                type={showPassword ? "text" : "password"}
                value={password}
              />
              <button
                aria-label={
                  showPassword ? "Приховати пароль" : "Показати пароль"
                }
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                type="button"
              >
                <img
                  alt=""
                  aria-hidden="true"
                  src={showPassword ? eyeOffIcon : eyeIcon}
                />
              </button>
            </div>
          </label>

          <p className="password-hint">
            Пароль має містити щонайменше 12 символів, велику й малу літеру,
            цифру та спецсимвол.
          </p>

          <button
            className="primary-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Зберігаємо..." : "Зберегти пароль"}
          </button>

          <Link className="back-link" to="/login">
            <ArrowLeft size={18} aria-hidden="true" />
            Повернутися до входу
          </Link>
        </form>
      </section>
    </main>
  );
}
