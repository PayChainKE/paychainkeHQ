import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { useState, useEffect } from "react";
import Index from "./pages/Index";
import Docs from "./pages/Docs";
import HowItWorks from "./pages/HowItWorks";
import FAQ from './pages/FAQ';
import ContactUs from "./pages/ContactUs";
import Products from "./pages/Products";
import InflationShield from "./pages/InflationShield";
import HybridSmartTill from "./pages/HybridSmartTill";
import PaychainBulkPay from "./pages/PaychainBulkPay";
import OperationsTools from "./pages/OperationsTools";
import Compliance from "./pages/Compliance";
import Overview from "./pages/Overview";
import PaychainDashboardProxy from './pages/PaychainDashboardProxy';
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import About from "./pages/About";
import Waitlist from "./pages/Waitlist";
import NotFound from "./pages/NotFound";
import Store from "./pages/Store";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import LoadingScreen from "./components/LoadingScreen";
import ScrollToTop from "./components/ScrollToTop";
import { CartProvider } from "./context/CartContext";

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
            <CartProvider>
              <BrowserRouter>
                <ScrollToTop />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/how-it-works" element={<HowItWorks />} />
                  <Route path="/docs" element={<Docs />} />
                  <Route path="/store" element={<Store />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/overview" element={<Overview />} />
                  <Route path="/paychain-dashboard/*" element={<PaychainDashboardProxy />} />
                  <Route path="/signin" element={<PaychainDashboardProxy />} />
                  <Route path="/signup" element={<PaychainDashboardProxy />} />
                  <Route path="/forgot-password" element={<PaychainDashboardProxy />} />
                  <Route path="/kyc/*" element={<PaychainDashboardProxy />} />
                  <Route path="/products/hybrid-smart-till" element={<HybridSmartTill />} />
                  <Route path="/products/inflation-shield" element={<InflationShield />} />
                  <Route path="/products/bulk-pay" element={<PaychainBulkPay />} />
                  <Route path="/products/operations-tools" element={<OperationsTools />} />
                  <Route path="/products/compliance" element={<Compliance />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/checkout" element={<Checkout />} />
                  <Route path="/faq" element={<FAQ />} />
                  <Route path="/contact" element={<ContactUs />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/waitlist" element={<Waitlist />} />
                  <Route path="/terms-of-service" element={<TermsOfService />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </CartProvider>
            <Analytics />
          </>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
