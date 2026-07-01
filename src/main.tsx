import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import { SidebarProvider } from "./context/SidebarContext";
import { ThemeProvider } from "./context/ThemeContext";
import { store } from "./redux/store";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          <NotificationProvider>
            <SidebarProvider>
              <App />
            </SidebarProvider>
          </NotificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>,
);
