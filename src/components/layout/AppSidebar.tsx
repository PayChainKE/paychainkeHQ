import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Store,
  Shield,
  FileText,
  Briefcase,
  ArrowLeftRight,
  TrendingUp,
  Building2,
  Settings,
} from "lucide-react";

const navItems = [
  { title: "Overview", path: "/", icon: LayoutDashboard },
  { title: "My Tills", path: "/tills", icon: Store },
  { title: "Inflation Shield", path: "/shield", icon: Shield },
  { title: "e-TIMS Hub", path: "/etims", icon: FileText },
  { title: "Supplier Escrow", path: "/escrow", icon: Briefcase },
  { title: "Payments", path: "/payments", icon: ArrowLeftRight },
  { title: "Cash Advance", path: "/advance", icon: TrendingUp },
  { title: "Payroll & Utilities", path: "/payroll", icon: Building2 },
  { title: "Settings", path: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <aside className="hidden md:flex flex-col w-[260px] min-h-screen bg-navy fixed left-0 top-0 bottom-0 z-40">
      {/* Logo */}
      <div className="px-6 py-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-sm">PK</span>
        </div>
        <div>
          <span className="text-primary-foreground font-semibold text-base tracking-tight">PayChainKE</span>
          <span className="text-emerald text-[10px] font-medium ml-1.5 tracking-wider">v2.0</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 mt-2 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200
                ${isActive
                  ? "bg-sidebar-active text-primary-foreground"
                  : "text-primary-foreground/60 hover:bg-sidebar-hover hover:text-primary-foreground/90"
                }`}
            >
              {isActive && (
                <div className="absolute left-0 top-2 bottom-2 w-1 bg-emerald rounded-r-full" />
              )}
              <item.icon className="w-[18px] h-[18px] shrink-0" />
              <span>{item.title}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-emerald/20 flex items-center justify-center">
            <span className="text-emerald text-xs font-semibold">AO</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-primary-foreground text-sm font-medium truncate">Amara Osei</p>
            <p className="text-primary-foreground/40 text-xs truncate">Merchant ID: PCK-8812</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
