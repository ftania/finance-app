import {
  ChartPie,
  Download,
  Landmark,
  LayoutDashboard,
  LogOut,
  ListChecks,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

const navItems = [
  {
    label: "Огляд",
    icon: LayoutDashboard,
    to: "/dashboard",
  },
  {
    label: "Аналітика",
    icon: ChartPie,
    to: "/analytics",
  },
  {
    label: "Банки / Рахунки",
    icon: Landmark,
    to: "/accounts",
  },
  {
    label: "Транзакції",
    icon: ListChecks,
    to: "/transactions",
  },
  {
    label: "Ліміти",
    icon: ShieldCheck,
    to: "/limits",
  },
  {
    label: "Звіти / Експорт",
    icon: Download,
    to: "/reports",
  },
  {
    label: "Профіль",
    icon: Settings,
    to: "/profile",
  },
];

export default function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">F</div>
          <div>
            <strong>Фінанси</strong>
            <span>Особистий бюджет</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Основна навігація">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                className={({ isActive }) =>
                  isActive ? "sidebar-link active" : "sidebar-link"
                }
                key={item.to}
                to={item.to}
              >
                <Icon size={19} aria-hidden="true" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <button className="sidebar-logout" onClick={handleLogout} type="button">
          <LogOut size={19} aria-hidden="true" />
          Вийти
        </button>
      </aside>

      <div className="app-content">
        <Outlet />
      </div>
    </div>
  );
}
