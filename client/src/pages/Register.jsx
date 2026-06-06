import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import eyeOffIcon from "../assets/eye-off-grey.svg";
import eyeIcon from "../assets/eye-grey.svg";
import { useAuth } from "../context/useAuth";

export default function Register() {
  const navigate = useNavigate();
  const { isAuthenticated, register } = useAuth();
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await register(form);
      navigate("/dashboard", { replace: true });
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Не вдалося створити акаунт",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-panel register-panel">
          <div className="brand-mark">F</div>
          <span className="eyebrow">Personal finance</span>
          <h1>Ласкаво просимо</h1>
          <p>
            Керуйте доходами, витратами та фінансовими цілями в одному зручному
            просторі
          </p>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="form-heading">
            <span>Реєстрація</span>
            <h2>Новий акаунт</h2>
          </div>

          {error ? <p className="form-error">{error}</p> : null}

          <label className="field">
            <span>Ім'я та прізвище</span>
            <div className="input-wrap">
              <UserRound size={18} aria-hidden="true" />
              <input
                autoComplete="name"
                minLength={2}
                name="fullName"
                onChange={handleChange}
                placeholder="Ваше ім'я та прізвище"
                required
                type="text"
                value={form.fullName}
              />
            </div>
          </label>

          <label className="field">
            <span>Email</span>
            <div className="input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input
                autoComplete="email"
                name="email"
                onChange={handleChange}
                placeholder="you@example.com"
                required
                type="email"
                value={form.email}
              />
            </div>
          </label>

          <label className="field">
            <span>Пароль</span>
            <div className="input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                autoComplete="new-password"
                minLength={12}
                name="password"
                onChange={handleChange}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}"
                placeholder="Мінімум 12 символів"
                required
                title="Пароль має містити велику й малу літеру, цифру та спецсимвол"
                type={showPassword ? "text" : "password"}
                value={form.password}
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

          <button
            className="primary-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Створюємо..." : "Зареєструватися"}
          </button>

          <p className="switch-auth">
            Вже маєте акаунт? <Link to="/login">Увійти</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
