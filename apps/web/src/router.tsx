import { createBrowserRouter, Navigate } from "react-router";
import { AuthPage } from "./routes/auth-page.js";

export const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/sign-in" replace /> },
  { path: "/sign-in", element: <AuthPage mode="sign-in" /> },
  { path: "/sign-up", element: <AuthPage mode="sign-up" /> },
]);
