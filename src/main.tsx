
import { createRoot } from "react-dom/client";
import  App  from "./app/App"; 
// @ts-ignore
import "./styles/index.css";
// Debug telemetry is only active when the ingestion server is explicitly
// opted-in via the VITE_ENABLE_DEBUG_TELEMETRY env variable.
// This prevents ERR_CONNECTION_REFUSED errors in normal dev/prod environments
// where 127.0.0.1:7654 is not running.
const DEBUG_TELEMETRY_ENABLED =
  typeof (import.meta as unknown as { env?: Record<string, string> }).env !== "undefined" &&
  (import.meta as unknown as { env: Record<string, string> }).env.VITE_ENABLE_DEBUG_TELEMETRY === "true";

const debugPost = (
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
) => {
  if (!DEBUG_TELEMETRY_ENABLED) return Promise.resolve();
  const DEBUG_INGEST_URL =
    (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_DEBUG_INGEST_URL ??
    "http://127.0.0.1:7654/ingest/1833b83f-257f-42c6-94c2-6caabce585fd";

  return fetch(DEBUG_INGEST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "d74b32",
    },
    body: JSON.stringify({
      sessionId: "d74b32",
      runId: "initial",
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
};

// #region agent log
debugPost(
  "src/main.tsx:module-init",
  "main.tsx module initialized",
  {},
  "H0",
);
// #endregion

window.addEventListener("error", (event) => {
  // #region agent log
  debugPost(
    "src/main.tsx:window.error",
    "Unhandled window error",
    {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    },
    "H4",
  );
  // #endregion
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason as { message?: string; stack?: string } | string | null;
  // #region agent log
  debugPost(
    "src/main.tsx:window.unhandledrejection",
    "Unhandled promise rejection",
    {
      reason:
        typeof reason === "string"
          ? reason
          : reason && typeof reason === "object"
            ? reason.message ?? "object-reason"
            : "unknown",
    },
    "H5",
  );
  // #endregion
});

const rootEl = document.getElementById("root");
// #region agent log
debugPost(
  "src/main.tsx:root-check",
  "Root element lookup result",
  { rootFound: Boolean(rootEl), readyState: document.readyState },
  "H1",
);
// #endregion

if (rootEl) {
  // #region agent log
  debugPost(
    "src/main.tsx:before-render",
    "About to render app root",
    { pathname: window.location.pathname },
    "H2",
  );
  // #endregion

  createRoot(rootEl).render(<App />);

  // #region agent log
  debugPost(
    "src/main.tsx:after-render-call",
    "Render call completed",
    {},
    "H3",
  );
  // #endregion
}
