import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import InflationShield from "./pages/InflationShield.tsx";
import ETimsHub from "./pages/ETimsHub.tsx";
import MyTills from "./pages/MyTills.tsx";
import Payroll from "./pages/Payroll.tsx";
import SupplierEscrow from "./pages/SupplierEscrow.tsx";
import Payments from "./pages/Payments.tsx";
import CashAdvance from "./pages/CashAdvance.tsx";
import Settings from "./pages/Settings.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/tills" element={<MyTills />} />
          <Route path="/shield" element={<InflationShield />} />
          <Route path="/etims" element={<ETimsHub />} />
          <Route path="/escrow" element={<SupplierEscrow />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/advance" element={<CashAdvance />} />
          <Route path="/payroll" element={<Payroll />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
