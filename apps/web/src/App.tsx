import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { lazy, Suspense } from "react";
import ScrollToTop from "./components/ScrollToTop";
import GoogleAnalyticsTracker from "./components/GoogleAnalyticsTracker";
import FloatingWhatsApp from "./components/FloatingWhatsApp";

// Route-level code splitting — every page used to be a static import here,
// so the full site bundle downloaded before the homepage could render.
// Each page now loads its own chunk on first visit to that route.
const Index = lazy(() => import("./pages/Index"));
const Docs = lazy(() => import("./pages/Docs"));
const Integrations = lazy(() => import("./pages/Integrations"));
const HowItWorks = lazy(() => import("./pages/HowItWorks"));
const FAQ = lazy(() => import('./pages/FAQ'));
const ContactUs = lazy(() => import("./pages/ContactUs"));
const Products = lazy(() => import("./pages/Products"));
const InflationShield = lazy(() => import("./pages/products/inflation-shield"));
const VirtualAccount = lazy(() => import("./pages/products/virtual-account"));
const PaychainBulkPay = lazy(() => import("./pages/products/paychain-bulk-pay"));
const OperationsTools = lazy(() => import("./pages/products/operations-tools"));
const CashAdvance = lazy(() => import("./pages/products/cash-advance"));
const Overview = lazy(() => import("./pages/Overview"));
const PaychainDashboardProxy = lazy(() => import('./pages/PaychainDashboardProxy'));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const About = lazy(() => import("./pages/About"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const BookDemo = lazy(() => import("./pages/BookDemo"));

const queryClient = new QueryClient();


const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <GoogleAnalyticsTracker />
          <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/integrations" element={<Integrations />} />
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
          </Suspense>
        </BrowserRouter>
        <Analytics />
        <FloatingWhatsApp />
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
