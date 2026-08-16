import React from "react";
import { Routes, Route } from "react-router-dom";
import DocsLayout from "@/components/DocsLayout";
import { CodeLangProvider } from "@/context/CodeLangContext";
import Introduction from "@/pages/Introduction";
import IntegrationGuide from "@/pages/IntegrationGuide";
import Authentication from "@/pages/Authentication";
import Payments from "@/pages/Payments";
import Checkout from "@/pages/Checkout";
import Webhooks from "@/pages/Webhooks";
import Errors from "@/pages/Errors";
import Guides from "@/pages/Guides";

export default function App() {
  return (
    <CodeLangProvider>
      <DocsLayout>
        <Routes>
          <Route path="/" element={<Introduction />} />
          <Route path="/integration-guide" element={<IntegrationGuide />} />
          <Route path="/authentication" element={<Authentication />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/webhooks" element={<Webhooks />} />
          <Route path="/errors" element={<Errors />} />
          <Route path="/guides" element={<Guides />} />
        </Routes>
      </DocsLayout>
    </CodeLangProvider>
  );
}
