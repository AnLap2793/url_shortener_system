import { createBrowserRouter, Navigate } from "react-router";
import { AccountPage } from "./routes/account-page.js";
import { AuthPage } from "./routes/auth-page.js";
import { DashboardPage } from "./routes/dashboard-page.js";
import { LinksPage } from "./routes/links-page.js";
import { ProtectedLayout } from "./routes/protected-layout.js";
import { createSessionLoader } from "./routes/session-loader.js";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/sign-in" replace /> },
  { path: "/sign-in", element: <AuthPage mode="sign-in" /> },
  { path: "/sign-up", element: <AuthPage mode="sign-up" /> },
  {
    element: <ProtectedLayout />,
    loader: createSessionLoader(),
    hydrateFallbackElement: <p className="visually-hidden">Loading…</p>,
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/links", element: <LinksPage /> },
      { path: "/account", element: <AccountPage /> },
    ],
  },
]);
