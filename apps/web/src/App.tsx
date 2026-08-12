import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { useState, useEffect } from "react";
import Index from "./pages/Index";
import Docs from "./pages/Docs";
import HowItWorks from "./pages/HowItWorks";
import FAQ from './pages/FAQ';
import ContactUs from "./pages/ContactUs";
import Products from "./pages/Products";
import InflationShield from "./pages/products/inflation-shield";
import VirtualAccount from "./pages/products/virtual-account";
import PaychainBulkPay from "./pages/products/paychain-bulk-pay";
import OperationsTools from "./pages/products/operations-tools";
import CashAdvance from "./pages/products/cash-advance";
import Overview from "./pages/Overview";
import PaychainDashboardProxy from './pages/PaychainDashboardProxy';
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import LoadingScreen from "./components/LoadingScreen";
import ScrollToTop from "./components/ScrollToTop";
import BookDemo from "./pages/BookDemo";

import FloatingWhatsApp from "./components/FloatingWhatsApp";

const queryClient = new QueryClient();


const App = () => {
  // One-time splash: show only on first visit
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    try {
      const shown = localStorage.getItem('paychain_splash_shown');
      if (!shown) {
        setIsLoading(true);
        const t = setTimeout(() => {
          setIsLoading(false);
          localStorage.setItem('paychain_splash_shown', '1');
        }, 2200);
        return () => clearTimeout(t);
      }
    } catch (e) {
      // ignore localStorage failures
      setIsLoading(false);
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LoadingScreen isLoading={isLoading} />
        {!isLoading && (
          <>
            <Toaster />
            <Sonner />
              <BrowserRouter>
                <ScrollToTop />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/how-it-works" element={<HowItWorks />} />
                  <Route path="/docs" element={<Docs />} />
                  <Route path="/blog" element={<Blog />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/overview" element={<Overview />} />
                  <Route path="/paychain-dashboard/*" element={<PaychainDashboardProxy />} />
                  <Route path="/signin" element={<PaychainDashboardProxy />} />
                  <Route path="/signup" element={<PaychainDashboardProxy />} />
                  <Route path="/forgot-password" element={<PaychainDashboardProxy />} />
                  <Route path="/kyc/*" element={<PaychainDashboardProxy />} />
                  <Route path="/products/virtual-account" element={<VirtualAccount />} />
                  {/* Old product URL — keep resolving so existing bookmarks/shared links don't break */}
                  <Route path="/products/hybrid-smart-till" element={<Navigate to="/products/virtual-account" replace />} />
                  <Route path="/products/inflation-shield" element={<InflationShield />} />
                  <Route path="/products/bulk-pay" element={<PaychainBulkPay />} />
                  <Route path="/products/operations-tools" element={<OperationsTools />} />
                  <Route path="/products/cash-advance" element={<CashAdvance />} />
                  <Route path="/blog/:id" element={<BlogPost />} />
                  <Route path="/faq" element={<FAQ />} />
                  <Route path="/contact" element={<ContactUs />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/book-demo" element={<BookDemo />} />
                  <Route path="/terms-of-service" element={<TermsOfService />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            <Analytics />
            <FloatingWhatsApp />
          </>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
