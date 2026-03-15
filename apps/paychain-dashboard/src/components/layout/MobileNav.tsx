import { useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Store, Shield, Building2, MoreHorizontal } from "lucide-react";

const tabs = [
  { title: "Overview", path: "/", icon: LayoutDashboard },
  { title: "Tills", path: "/tills", icon: Store },
  { title: "Shield", path: "/shield", icon: Shield },
  { title: "Payroll", path: "/payroll", icon: Building2 },
  { title: "More", path: "/etims", icon: MoreHorizontal },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-card z-50 flex items-center justify-around bottom-safe"
      style={{ boxShadow: "0 -4px 16px rgba(15,23,42,0.04)" }}>
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={`flex flex-col items-center gap-0.5 min-w-[48px] min-h-[48px] justify-center transition-colors
              ${isActive ? "text-emerald" : "text-muted-foreground"}`}
          >
            <tab.icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{tab.title}</span>
          </Link>
        );
      })}
    </nav>
  );
}
