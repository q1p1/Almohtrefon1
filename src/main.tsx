import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./styles/tailwind.css";
import "./assets/fonts.css";
import App from "./App.tsx";

// Start MSW in development to mock backend APIs
if (import.meta.env.DEV) {
  import("./api/mocks/browser")
    .then(({ worker }) => {
      try {
        worker.start({ onUnhandledRequest: "bypass" });
      } catch (error) {
        console.error("خطأ في بدء MSW:", error);
      }
    })
    .catch((error) => {
      console.error("خطأ في تحميل MSW:", error);
    });
}

try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter basename="/Almohtrefon1">
        <App />
      </BrowserRouter>
    </StrictMode>
  );
} catch (error) {
  console.error("خطأ في عرض التطبيق:", error);
}
