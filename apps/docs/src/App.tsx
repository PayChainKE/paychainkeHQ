import React from "react";
import { Routes, Route, Outlet } from "react-router-dom";
import DocsLayout from "@/components/DocsLayout";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { CodeLangProvider } from "@/context/CodeLangContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { DeveloperAuthProvider } from "@/context/DeveloperAuthContext";
import Introduction from "@/pages/Introduction";
import IntegrationGuide from "@/pages/IntegrationGuide";
import Authentication from "@/pages/Authentication";
import Payments from "@/pages/Payments";
import Checkout from "@/pages/Checkout";
import Webhooks from "@/pages/Webhooks";
import Errors from "@/pages/Errors";
import Guides from "@/pages/Guides";
import Help from "@/pages/Help";
import Signup from "@/pages/auth/Signup";
import Login from "@/pages/auth/Login";
import VerifyOtp from "@/pages/auth/VerifyOtp";
import Overview from "@/pages/dashboard/Overview";
import ApiKeys from "@/pages/dashboard/ApiKeys";
import DashboardWebhooks from "@/pages/dashboard/Webhooks";
import MerchantLink from "@/pages/dashboard/MerchantLink";
import LiveAccess from "@/pages/dashboard/LiveAccess";

function DocsPages() {
  return (
    <DocsLayout>
      <Outlet />
    </DocsLayout>
  );
}

function DashboardPages() {
  return (
    <DashboardShell>
      <Outlet />
    </DashboardShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DeveloperAuthProvider>
        <CodeLangProvider>
          <Routes>
            <Route element={<DocsPages />}>
              <Route path="/" element={<Introduction />} />
              <Route path="/integration-guide" element={<IntegrationGuide />} />
              <Route path="/authentication" element={<Authentication />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/webhooks" element={<Webhooks />} />
              <Route path="/errors" element={<Errors />} />
              <Route path="/guides" element={<Guides />} />
              <Route path="/help" element={<Help />} />
            </Route>

            <Route path="/signup" element={<Signup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/verify-email" element={<VerifyOtp />} />

            <Route element={<DashboardPages />}>
              <Route path="/dashboard" element={<Overview />} />
              <Route path="/dashboard/api-keys" element={<ApiKeys />} />
              <Route path="/dashboard/webhooks" element={<DashboardWebhooks />} />
              <Route path="/dashboard/merchant" element={<MerchantLink />} />
              <Route path="/dashboard/live-access" element={<LiveAccess />} />
            </Route>
          </Routes>
        </CodeLangProvider>
      </DeveloperAuthProvider>
    </ThemeProvider>
  );
}
