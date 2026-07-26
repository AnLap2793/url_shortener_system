import { useEffect } from "react";
import { EmptyState } from "../components/empty-state.js";

export function LinksPage() {
  useEffect(() => {
    document.title = "Links | Campaign Links";
  }, []);
  return (
    <>
      <h1 tabIndex={-1}>Links</h1>
      <EmptyState
        title="No short links yet."
        description="Creating short links will be available soon."
      />
    </>
  );
}
