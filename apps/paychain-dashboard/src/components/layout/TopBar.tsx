import { Bell } from "lucide-react";

export function TopBar() {
  return (
    <header className="h-16 flex items-center justify-between px-8 bg-card card-shadow sticky top-0 z-30">
      <div>
        <h2 className="text-foreground font-semibold text-base">Welcome, Amara Osei</h2>
        <p className="text-muted-foreground text-xs">Wednesday, March 12, 2026</p>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-xl hover:bg-muted transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald rounded-full" />
        </button>
        <div className="w-9 h-9 rounded-full bg-navy flex items-center justify-center">
          <span className="text-primary-foreground text-xs font-semibold">AO</span>
        </div>
      </div>
    </header>
  );
}
