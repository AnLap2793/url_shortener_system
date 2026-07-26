import { useEffect } from "react";
import { EmptyState } from "../components/empty-state.js";

export function AccountPage() {
  useEffect(() => {
    document.title = "Account | Campaign Links";
  }, []);
  return (
    <>
      <h1 tabIndex={-1}>Account</h1>
      <EmptyState
        title="Account settings are not available yet."
        description="Profile, sign-out and Google sign-in options are coming soon."
      />
    </>
  );
}
