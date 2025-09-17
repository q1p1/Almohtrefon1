  import { StrictMode } from "react";
  import { createRoot } from "react-dom/client";
  import "./styles/tailwind.css";
  import "./assets/fonts.css";
  import App from "./App.tsx";

  // Start MSW in development to mock backend APIs
  if (import.meta.env.DEV) {
    import("./api/mocks/browser")
      .then(({ worker }) => {
        try {
          worker.start({ 
            onUnhandledRequest: "bypass",
            serviceWorker: {
              url: './mockServiceWorker.js'
            }
          });
          console.log("MSW started successfully");
        } catch (error) {
          console.warn("MSW failed to start, continuing without mocks:", error);
        }
      })
      .catch((error) => {
        console.warn("MSW failed to load, continuing without mocks:", error);
      });
  }

  try {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    console.error("خطأ في عرض التطبيق:", error);
  }
