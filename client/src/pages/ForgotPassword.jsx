import { ArrowLeft, Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMessage(data.message);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Не вдалося створити запит",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-shell compact-auth">
        <div className="auth-panel">
          <div className="brand-mark">F</div>
          <span className="eyebrow">Відновлення доступу</span>
          <h1>Поверніться до свого бюджету</h1>
          <p>
            Вкажіть електронну пошту акаунта, і ми надішлемо лист для зміни
            пароля
          </p>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <div className="form-heading">
            <span>Пароль</span>
            <h2>Відновити доступ</h2>
          </div>

          {error ? <p className="form-error">{error}</p> : null}
          {message ? <p className="form-success">{message}</p> : null}

          <label className="field">
            <span>Електронна пошта</span>
            <div className="input-wrap">
              <Mail size={18} aria-hidden="true" />
              <input
                autoComplete="email"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </div>
          </label>

          <button
            className="primary-button"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Надсилаємо..." : "Надіслати лист"}
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
