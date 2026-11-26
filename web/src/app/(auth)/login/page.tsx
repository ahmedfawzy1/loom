import { LoginForm } from "@loom-web/src/components/auth/LoginForm";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Sign in · Loom" };

export default function LoginPage() {
  // The form reads ?next= with useSearchParams, which needs a boundary to render around
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
