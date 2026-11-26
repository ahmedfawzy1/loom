"use client";

import { Button, Input, Label, TextField } from "@heroui/react";
import type { PasswordLinkDetailsResponseDto } from "@loom/dto";
import { AuthCard } from "@loom-web/src/components/auth/AuthCard";
import { NewPasswordFields } from "@loom-web/src/components/auth/NewPasswordFields";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { auth } from "@loom-web/src/lib/api";
import { LOGIN_PATH } from "@loom-web/src/lib/auth/redirect";
import { formatDateTime } from "@loom-web/src/lib/format/date";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

/** The token from `#token=…`. Undefined until the page has read it, null when there is none. */
function useLinkToken() {
  const [token, setToken] = useState<string | null>();
  useEffect(() => {
    setToken(
      new URLSearchParams(window.location.hash.slice(1)).get("token") || null,
    );
  }, []);
  return token;
}

function DeadLink({ reason }: { reason: string }) {
  return (
    <AuthCard description={reason} title="This link doesn't work">
      <Link className="text-accent text-sm hover:underline" href={LOGIN_PATH}>
        Go to sign in
      </Link>
    </AuthCard>
  );
}

function ChoosePassword({
  token,
  link,
}: {
  token: string;
  link: Serialized<PasswordLinkDetailsResponseDto>;
}) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const setNewPassword = useMutation({
    mutationFn: auth.setPassword,
    // Replace, not push: the link is spent, so Back would only show that
    onSuccess: () => window.location.replace("/"),
  });
  const who = link.name ? `${link.name} (${link.email})` : link.email;

  return (
    <AuthCard
      description={
        link.isInvite
          ? `Choose a password for ${who} to finish setting up your account.`
          : `Choose a new password for ${who}. Anywhere else this account is signed in will be signed out.`
      }
      title={link.isInvite ? "Welcome to Loom" : "Choose a new password"}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!setNewPassword.isPending)
            setNewPassword.mutate({ token, password });
        }}
      >
        {/* Which account this is, for password managers to save the new password against */}
        <TextField
          autoComplete="username"
          className="flex flex-col gap-1.5"
          isReadOnly
          name="email"
          type="email"
          value={link.email}
        >
          <Label className="font-medium text-[13px]">Email</Label>
          <Input className="text-muted" />
        </TextField>
        <NewPasswordFields
          confirmation={confirmation}
          label="Password"
          onConfirmationChange={setConfirmation}
          onPasswordChange={setPassword}
          password={password}
        />
        {setNewPassword.error && (
          <ErrorText message={setNewPassword.error.message} />
        )}
        <Button
          className="mt-1 w-full"
          isDisabled={setNewPassword.isPending}
          type="submit"
        >
          {setNewPassword.isPending ? "Saving…" : "Save and sign in"}
        </Button>
      </form>
      <p className="text-muted text-xs leading-5">
        This link works once, until {formatDateTime(link.expiresAt)}.
      </p>
    </AuthCard>
  );
}

/** Where an invite or a password reset lands: whose account, then the password to choose. */
export function SetPasswordForm() {
  const token = useLinkToken();
  const link = useQuery({
    queryKey: ["password-link", token],
    queryFn: () => auth.passwordLink(token ?? ""),
    enabled: Boolean(token),
  });

  if (token === null)
    return (
      <DeadLink reason="This link is missing its last part. Open the whole link you were sent, or ask an Admin for a new one." />
    );
  if (link.error) return <DeadLink reason={link.error.message} />;
  if (!token || !link.data) return <AuthCard title="Opening your link…" />;

  return <ChoosePassword link={link.data} token={token} />;
}
