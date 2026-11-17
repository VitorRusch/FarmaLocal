import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeftRight,
  ChevronLeft,
  Cross,
  Database,
  LayoutDashboard,
  Menu,
  Moon,
  Sun,
  Package,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { db, type Medication, status } from "@/lib/pharmacy/database";
export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [themeReady, setThemeReady] = useState(false);
  useEffect(() => {
    let active = true;
    void db()
      .settings.get("theme")
      .then((setting) => {
        if (!active) return;
        const next = setting?.value === "light" ? "light" : "dark";
        setTheme(next);
        document.documentElement.dataset["theme"] = next;
        setThemeReady(true);
      })
      .catch(() => {
        if (active) setThemeReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  async function changeTheme() {
    const next = theme === "dark" ? "light" : "dark";
    await db().settings.put({ id: "theme", value: next });
    setTheme(next);
    document.documentElement.dataset["theme"] = next;
  }
  const links = [
    { to: "/", label: "Visão Geral", icon: LayoutDashboard },
    { to: "/estoque", label: "Estoque de Medicamentos", icon: Package },
    { to: "/movimentacoes", label: "Movimentações", icon: ArrowLeftRight },
    { to: "/importar", label: "Importar Planilha", icon: Upload },
    { to: "/exportar", label: "Exportar Dados", icon: ArrowDownToLine },
    { to: "/backup", label: "Backup e Restauração", icon: Database },
  ] as const;
  return (
    <div className={`app-shell ${collapsed ? "sidebar-mini" : ""} ${mobile ? "sidebar-open" : ""}`}>
      <aside className="app-sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Cross size={23} strokeWidth={2.8} />
          </span>
          <span className="brand-text">
            <strong>
              FarmaLocal<span>.</span>
            </strong>
            <small>FARMÁCIA HOSPITALAR</small>
          </span>
        </Link>
        <div className="sidebar-section">PRINCIPAL</div>
        <nav>
          {links.map(({ to, label, icon: Icon }, i) => (
            <div key={to} className={i === 3 ? "nav-divider" : ""}>
              <Link
                to={to}
                title={label}
                activeOptions={{ exact: true }}
                activeProps={{ className: "nav-link nav-active" }}
                inactiveProps={{ className: "nav-link" }}
                onClick={() => setMobile(false)}
              >
                <Icon size={19} />
                <span>{label}</span>
              </Link>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-notice">
            <span className="local-dot" />
            <div>
              <strong>Armazenamento local</strong>
              <small>Seus dados ficam neste computador</small>
            </div>
            <ShieldCheck size={17} />
          </div>
          <Button
            variant="ghost"
            size="icon"
            title={collapsed ? "Expandir menu" : "Recolher menu"}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            onClick={() => {
              setCollapsed(!collapsed);
              setMobile(false);
            }}
            className="collapse-button"
          >
            <ChevronLeft className={collapsed ? "rotate-180" : ""} />
          </Button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              onClick={() => setMobile(!mobile)}
              aria-label="Abrir menu"
            >
              {mobile ? <X /> : <Menu />}
            </Button>
            <span className="topbar-label">
              Gestão de estoque <span>/</span> Farmácia hospitalar
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              disabled={!themeReady}
              title={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
              onClick={() => void changeTheme()}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
            <span className="local-label">
              <span className="local-dot" />
              Modo local
            </span>
            <span className="topbar-separator" />
            <span className="profile-avatar">
              <Cross size={16} />
            </span>
          </div>
        </header>
        <main>{children}</main>
        <footer>
          <span>
            <ShieldCheck size={13} /> Dados armazenados somente neste computador
          </span>
          <span>
            FarmaLocal <span className="footer-dot">·</span> Gestão com cuidado
          </span>
        </footer>
      </div>
      {mobile && <div className="mobile-overlay" onClick={() => setMobile(false)} />}
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function StockBadge({ med }: { med: Medication }) {
  const s = med.isActive ? status(med) : "inativo";
  return (
    <span className={`status-badge status-${s}`}>
      <span />
      {{ normal: "Normal", baixo: "Estoque baixo", zerado: "Zerado", inativo: "Inativo" }[s]}
    </span>
  );
}
export function EmptyState({
  icon: Icon = Package,
  title,
  description,
  children,
}: {
  icon?: typeof Package;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "success";
}) {
  return (
    <div className={`notice notice-${tone}`}>
      <ShieldCheck size={19} />
      <div>{children}</div>
    </div>
  );
}
export function LoadingState({ error, ready }: { error: string; ready: boolean }) {
  return error ? (
    <Notice tone="warning">Não foi possível acessar os dados locais: {error}</Notice>
  ) : !ready ? (
    <div className="loading-state">
      <Activity size={20} /> Carregando estoque local…
    </div>
  ) : null;
}
export const dateLabel = (value: string) => new Date(value).toLocaleDateString("pt-BR");
export const timeLabel = (value: string) =>
  new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const num = (n: number) => n.toLocaleString("pt-BR");
