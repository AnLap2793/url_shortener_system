import { useEffect } from "react";
import { Form, useActionData, useNavigation } from "react-router";
import { PrimaryButton } from "../components/primary-button.js";
import type { SignOutActionResult } from "./authentication-actions.js";

export function AccountPage() {
  const navigation = useNavigation();
  const action = useActionData() as SignOutActionResult | undefined;
  const pending = navigation.state === "submitting";

  useEffect(() => {
    document.title = "Account | Campaign Links";
  }, []);

  return (
    <>
      <h1 tabIndex={-1}>Account</h1>
      <p>Profile and Google sign-in options are not available yet.</p>
      <Form method="post" replace onSubmit={(event) => { if (pending) event.preventDefault(); }}>
        {action?.status === "error" && <p role="alert">{action.message}</p>}
        <PrimaryButton type="submit" loading={pending} loadingLabel="Signing out…">Sign out</PrimaryButton>
      </Form>
    </>
  );
}
