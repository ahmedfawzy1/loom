"use client";

import { Button, FieldError, Input, Label, TextField } from "@heroui/react";
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH } from "@loom/dto/constants";
import { AuthCard } from "@loom-web/src/components/auth/AuthCard";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { auth } from "@loom-web/src/lib/api";
import { safeNextPath } from "@loom-web/src/lib/auth/redirect";
import { useMutation } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: auth.login,
    // A full page load, so the CMS starts afresh as whoever just signed in. Replace, not push: Back
    // should not land on the sign-in page again.
    onSuccess: () =>
      window.location.replace(safeNextPath(searchParams.get("next"))),
  });

  return (
    <AuthCard
      description="Sign in with the email and password for your Loom account."
      title="Sign in"
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!login.isPending) login.mutate({ email, password });
        }}
      >
        <TextField
          autoComplete="username"
          autoFocus
          className="flex flex-col gap-1.5"
          isRequired
          maxLength={EMAIL_MAX_LENGTH}
          name="email"
          onChange={setEmail}
          type="email"
          value={email}
        >
          <Label className="font-medium text-[13px]">Email</Label>
          <Input placeholder="you@example.com" />
          <FieldError />
        </TextField>
        <TextField
          autoComplete="current-password"
          className="flex flex-col gap-1.5"
          isRequired
          maxLength={PASSWORD_MAX_LENGTH}
          name="password"
          onChange={setPassword}
          type="password"
          value={password}
        >
          <Label className="font-medium text-[13px]">Password</Label>
          <Input />
          <FieldError />
        </TextField>
        {login.error && <ErrorText message={login.error.message} />}
        <Button
          className="mt-1 w-full"
          isDisabled={login.isPending}
          type="submit"
        >
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="text-muted text-xs leading-5">
        Forgot your password, or never set one? Ask an Admin to send you a new
        link.
      </p>
    </AuthCard>
  );
}
