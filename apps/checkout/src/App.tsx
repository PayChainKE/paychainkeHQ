import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Pay from "@/pages/Pay";

export default function App() {
  return (
    <Routes>
      <Route path="/pay/:sessionId" element={<Pay />} />
      <Route path="/" element={<CenteredMessage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function CenteredMessage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <p className="text-sm text-ink-faint">This is a PayChain checkout link — open it from where you were sent to pay.</p>
    </div>
  );
}
