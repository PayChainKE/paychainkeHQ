import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Temporary runtime error overlay to surface client-side exceptions
try {
	const root = document.getElementById("root");
	if (!root) throw new Error('Root element not found');
	createRoot(root).render(<App />);
} catch (err) {
	// Show error details on the page to help debugging a blank screen
	const root = document.getElementById("root");
	if (root) {
		root.innerHTML = `<div style="padding:24px;font-family:system-ui,Arial;background:#fff;color:#111"><h2>Application Error</h2><pre style="white-space:pre-wrap;">${String(err)}</pre><p>Check console for stack trace.</p></div>`;
	}
	// Also re-throw to ensure Vite overlay still works
	throw err;
}
