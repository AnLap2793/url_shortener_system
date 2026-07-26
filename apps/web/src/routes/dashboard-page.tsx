import { useEffect } from "react";
import { EmptyState } from "../components/empty-state.js";

export function DashboardPage() {
  useEffect(() => {
    document.title = "Dashboard | Campaign Links";
  }, []);
  return (
    <>
      <h1 tabIndex={-1}>Dashboard</h1>
      <EmptyState
        title="No analytics yet."
        description="Campaign analytics will appear here once links start collecting clicks."
      />
    </>
  );
}
