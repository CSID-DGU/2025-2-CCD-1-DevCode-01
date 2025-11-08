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
import { initTTS } from "@styles/useLocalTTS";

function App() {
  useEffect(() => {
    migrateA11yKeysOnce();
    applyA11yFromStorage();
  }, []);

  useEffect(() => {
    const handler = () => {
      initTTS();
      window.removeEventListener("click", handler);
    };
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
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
