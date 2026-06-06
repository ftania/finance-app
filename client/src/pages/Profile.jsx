import { LogOut, LockKeyhole, Mail, Save, UserRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/api";
import eyeOffIcon from "../assets/eye-off-grey.svg";
import eyeIcon from "../assets/eye-grey.svg";
import { useAuth } from "../context/useAuth";

const currencies = ["UAH", "USD", "EUR"];

export default function Profile() {
  const { logout, refreshUser, user } = useAuth();
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || "",
    currency: user?.currency || "UAH",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleProfileChange = (event) => {
    setProfileForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handlePasswordChange = (event) => {
    setPasswordForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileError("");
    setProfileMessage("");
    setIsSavingProfile(true);

    try {
      await api.patch("/users/me", profileForm);
      await refreshUser();
      setProfileMessage("Профіль оновлено");
    } catch (requestError) {
      setProfileError(
        requestError.response?.data?.message || "Не вдалося оновити профіль",
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    setIsChangingPassword(true);

    try {
      await api.patch("/users/me/password", passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setPasswordMessage("Пароль змінено");
    } catch (requestError) {
      setPasswordError(
        requestError.response?.data?.message || "Не вдалося змінити пароль",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <main className="settings-page">
      <section className="settings-header">
        <span className="eyebrow">Профіль / Налаштування</span>
        <h1>Налаштування акаунта</h1>
        <p>
          Оновіть особисті дані, оберіть валюту та керуйте доступом до акаунта
        </p>
      </section>

      <section className="settings-grid">
        <form className="settings-card" onSubmit={handleProfileSubmit}>
          <div className="settings-card-heading">
            <UserRound size={22} aria-hidden="true" />
            <div>
              <span>Особисті дані</span>
              <h2>Профіль</h2>
            </div>
          </div>

          {profileError ? <p className="form-error">{profileError}</p> : null}
          {profileMessage ? (
            <p className="form-success">{profileMessage}</p>
          ) : null}

          <label className="field">
            <span>Ім'я та прізвище</span>
            <div className="input-wrap">
              <UserRound size={18} aria-hidden="true" />
              <input
                minLength={2}
                name="fullName"
                onChange={handleProfileChange}
                required
                type="text"
                value={profileForm.fullName}
              />
            </div>
          </label>

          <label className="field">
            <span>Електронна пошта</span>
            <div className="input-wrap readonly-input">
              <Mail size={18} aria-hidden="true" />
              <input readOnly type="email" value={user?.email || ""} />
            </div>
          </label>

          <label className="field">
            <span>Валюта</span>
            <div className="input-wrap select-wrap">
              <select
                name="currency"
                onChange={handleProfileChange}
                value={profileForm.currency}
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <button
            className="primary-button"
            disabled={isSavingProfile}
            type="submit"
          >
            {isSavingProfile ? "Зберігаємо..." : "Зберегти зміни"}
            <Save size={18} aria-hidden="true" />
          </button>
        </form>

        <form className="settings-card" onSubmit={handlePasswordSubmit}>
          <div className="settings-card-heading">
            <LockKeyhole size={22} aria-hidden="true" />
            <div>
              <span>Доступ</span>
              <h2>Зміна пароля</h2>
            </div>
          </div>

          {passwordError ? <p className="form-error">{passwordError}</p> : null}
          {passwordMessage ? (
            <p className="form-success">{passwordMessage}</p>
          ) : null}

          <label className="field">
            <span>Поточний пароль</span>
            <div className="input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                autoComplete="current-password"
                name="currentPassword"
                onChange={handlePasswordChange}
                required
                type={showCurrentPassword ? "text" : "password"}
                value={passwordForm.currentPassword}
              />
              <button
                aria-label={
                  showCurrentPassword ? "Приховати пароль" : "Показати пароль"
                }
                className="password-toggle"
                onClick={() => setShowCurrentPassword((current) => !current)}
                type="button"
              >
                <img
                  alt=""
                  aria-hidden="true"
                  src={showCurrentPassword ? eyeOffIcon : eyeIcon}
                />
              </button>
            </div>
          </label>

          <label className="field">
            <span>Новий пароль</span>
            <div className="input-wrap">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                autoComplete="new-password"
                minLength={12}
                name="newPassword"
                onChange={handlePasswordChange}
                pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}"
                required
                title="Пароль має містити велику й малу літеру, цифру та спецсимвол"
                type={showNewPassword ? "text" : "password"}
                value={passwordForm.newPassword}
              />
              <button
                aria-label={
                  showNewPassword ? "Приховати пароль" : "Показати пароль"
                }
                className="password-toggle"
                onClick={() => setShowNewPassword((current) => !current)}
                type="button"
              >
                <img
                  alt=""
                  aria-hidden="true"
                  src={showNewPassword ? eyeOffIcon : eyeIcon}
                />
              </button>
            </div>
          </label>

          <p className="password-hint">
            Новий пароль має містити щонайменше 12 символів, велику й малу
            літеру, цифру та спецсимвол.
          </p>

          <Link className="forgot-link profile-forgot-link" to="/forgot-password">
            Забули пароль?
          </Link>

          <button
            className="primary-button"
            disabled={isChangingPassword}
            type="submit"
          >
            {isChangingPassword ? "Оновлюємо..." : "Змінити пароль"}
          </button>
        </form>

        <div className="settings-card account-card">
          <p>Завершіть сеанс на цьому пристрої</p>
          <button
            className="ghost-button danger-button"
            onClick={logout}
            type="button"
          >
            <LogOut size={18} aria-hidden="true" />
            Вийти з акаунта
          </button>
        </div>
      </section>
    </main>
  );
}
