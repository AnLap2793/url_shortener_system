import { createBrowserRouter, Navigate } from "react-router";
import { AccountPage } from "./routes/account-page.js";
import {
  shouldRevalidateProtectedSession,
  signInAction,
  signOutAction,
} from "./routes/authentication-actions.js";
import { AuthPage } from "./routes/auth-page.js";
import { DashboardPage } from "./routes/dashboard-page.js";
import { LinksPage } from "./routes/links-page.js";
import { ProtectedLayout } from "./routes/protected-layout.js";
import { signUpAction } from "./routes/registration-actions.js";
import { createSessionLoader } from "./routes/session-loader.js";
import { VerifyEmailPage } from "./routes/verify-email-page.js";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/sign-in" replace /> },
  { path: "/sign-in", element: <AuthPage mode="sign-in" />, action: signInAction },
  { path: "/sign-up", element: <AuthPage mode="sign-up" />, action: signUpAction },
  { path: "/verify-email", element: <VerifyEmailPage /> },
  {
    element: <ProtectedLayout />,
    loader: createSessionLoader(),
    shouldRevalidate: shouldRevalidateProtectedSession,
    hydrateFallbackElement: <p className="visually-hidden">Loading…</p>,
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/links", element: <LinksPage /> },
      { path: "/account", element: <AccountPage />, action: signOutAction },
    ],
  },
]);
