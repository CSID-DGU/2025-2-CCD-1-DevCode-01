import { RouterProvider } from "react-router-dom";
import router from "@routes/router";
import GlobalStyle from "@styles/globalStyle";
import { ThemeProvider } from "styled-components";
import { theme } from "@styles/theme";
import { Toaster } from "react-hot-toast";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Toaster
        position="top-center"
        toastOptions={{
          style: { zIndex: 999999 },
        }}
      />
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}

export default App;
