import { RouterProvider } from "react-router-dom";
import router from "@routes/router";
import GlobalStyle from "@styles/globalStyle";
import { ThemeProvider } from "styled-components";
import { theme } from "@styles/theme";
import { Toaster } from "react-hot-toast";
import { TTSProvider } from "@shared/tts/TTSProvider";
import { useEffect } from "react";
import {
  applyA11yFromStorage,
  migrateA11yKeysOnce,
} from "@shared/a11y/initA11y";
import { initTTS } from "./hooks/useLocalTTS";

function App() {
  useEffect(() => {
    migrateA11yKeysOnce();
    applyA11yFromStorage();
  }, []);

  useEffect(() => {
    const click = () => {
      initTTS();
      window.removeEventListener("click", click);
      window.removeEventListener("keydown", keydown);
    };
    const keydown = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        initTTS();
        window.removeEventListener("click", click);
        window.removeEventListener("keydown", keydown);
      }
    };
    window.addEventListener("click", click, { once: false });
    window.addEventListener("keydown", keydown, { once: false });
    return () => {
      window.removeEventListener("click", click);
      window.removeEventListener("keydown", keydown);
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <TTSProvider>
        <GlobalStyle />
        <Toaster
          position="top-center"
          toastOptions={{
            style: { zIndex: 999999 },
          }}
        />

        <RouterProvider router={router} />
      </TTSProvider>
    </ThemeProvider>
  );
}

export default App;
