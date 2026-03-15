import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="md:ml-[260px] flex flex-col min-h-screen">
        <TopBar />
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-[1200px] w-full mx-auto">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
