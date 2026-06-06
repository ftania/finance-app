import { LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import eyeOffIcon from "../assets/eye-off-grey.svg";
import eyeIcon from "../assets/eye-grey.svg";
import { useAuth } from "../context/useAuth";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const redirectTo = location.state?.from?.pathname || "/dashboard";

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
      await login(form);
      navigate(redirectTo, { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не вдалося увійти");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-shell">
        <div className="auth-panel">
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
            <span>Увійти</span>
            <h2>Ваш фінансовий простір</h2>
          </div>

          {error ? <p className="form-error">{error}</p> : null}

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
                autoComplete="current-password"
                name="password"
                onChange={handleChange}
                placeholder="Ваш пароль"
                required
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
                  src={showPassword ? eyeOffIcon : eyeIcon}
                  aria-hidden="true"
                />
              </button>
            </div>
          </label>

          <button
            className="primary-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Входимо..." : "Увійти"}
          </button>

          <Link className="forgot-link" to="/forgot-password">
            Забули пароль?
          </Link>

          <p className="switch-auth">
            Немає акаунта? <Link to="/register">Створити акаунт</Link>
          </p>
        </form>
      </section>
    </main>
  );
}
