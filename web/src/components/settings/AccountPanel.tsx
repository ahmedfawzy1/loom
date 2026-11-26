"use client";

import {
  Button,
  FieldError,
  Input,
  Label,
  TextField,
  toast,
} from "@heroui/react";
import { PASSWORD_MAX_LENGTH } from "@loom/dto/constants";
import { NewPasswordFields } from "@loom-web/src/components/auth/NewPasswordFields";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { Section } from "@loom-web/src/components/ui/Section";
import { ROLE_NAMES } from "@loom-web/src/constants/roles";
import { useCurrentUser } from "@loom-web/src/hooks/user/useCurrentUser";
import { useChangePassword } from "@loom-web/src/hooks/user/useSession";
import { useState } from "react";

function ChangePasswordForm({ email }: { email: string }) {
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  return (
    <form
      className="flex max-w-sm flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (changePassword.isPending) return;
        changePassword.mutate(
          { currentPassword, newPassword },
          {
            onSuccess: () => {
              setCurrentPassword("");
              setNewPassword("");
              setConfirmation("");
              toast.success(
                "Password changed. You're signed out everywhere else.",
              );
            },
          },
        );
      }}
    >
      {/* Which account this is, for password managers to update the right entry */}
      <input
        autoComplete="username"
        hidden
        name="email"
        readOnly
        type="email"
        value={email}
      />
      <TextField
        autoComplete="current-password"
        className="flex flex-col gap-1.5"
        isRequired
        maxLength={PASSWORD_MAX_LENGTH}
        name="current-password"
        onChange={setCurrentPassword}
        type="password"
        value={currentPassword}
      >
        <Label className="font-medium text-[13px]">Current password</Label>
        <Input />
        <FieldError />
      </TextField>
      <NewPasswordFields
        confirmation={confirmation}
        onConfirmationChange={setConfirmation}
        onPasswordChange={setNewPassword}
        password={newPassword}
      />
      {changePassword.error && (
        <ErrorText message={changePassword.error.message} />
      )}
      <div>
        <Button isDisabled={changePassword.isPending} type="submit">
          {changePassword.isPending ? "Saving…" : "Change password"}
        </Button>
      </div>
    </form>
  );
}

/** The signed-in person's own account: who Loom has them as, and their password. */
export function AccountPanel() {
  const { data: user } = useCurrentUser();
  if (!user) return null;

  return (
    <>
      <Section
        description="Set when an Admin added you. An Admin can change your role in Users."
        title="Your account"
      >
        <dl className="grid max-w-md grid-cols-[7rem_1fr] gap-y-2 text-sm">
          <dt className="text-muted">Name</dt>
          <dd>{user.name ?? "—"}</dd>
          <dt className="text-muted">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-muted">Role</dt>
          <dd>{ROLE_NAMES[user.role]}</dd>
        </dl>
      </Section>
      <Section
        description="Changing it signs you out everywhere else. This browser stays signed in."
        title="Password"
      >
        <ChangePasswordForm email={user.email} />
      </Section>
    </>
  );
}
