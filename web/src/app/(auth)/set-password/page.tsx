import { SetPasswordForm } from "@loom-web/src/components/auth/SetPasswordForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Choose a password · Loom" };

/**
 * Where a password link lands — the invite an Admin sends, or a reset. The token rides in the
 * URL's fragment (`#token=…`), which the browser never sends to a server, so it stays out of logs.
 */
export default function SetPasswordPage() {
  return <SetPasswordForm />;
}
