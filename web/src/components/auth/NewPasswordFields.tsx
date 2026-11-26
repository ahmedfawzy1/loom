"use client";

import {
  Description,
  FieldError,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@loom/dto/constants";

/**
 * A new password, typed twice. The browser checks both when the form is submitted, so the form's
 * submit handler only runs once they are long enough and match. `autoComplete="new-password"` lets
 * a password manager offer a strong one and save it.
 */
export function NewPasswordFields({
  password,
  confirmation,
  onPasswordChange,
  onConfirmationChange,
  label = "New password",
}: {
  password: string;
  confirmation: string;
  onPasswordChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  label?: string;
}) {
  return (
    <>
      <TextField
        autoComplete="new-password"
        className="flex flex-col gap-1.5"
        isRequired
        maxLength={PASSWORD_MAX_LENGTH}
        minLength={PASSWORD_MIN_LENGTH}
        name="new-password"
        onChange={onPasswordChange}
        type="password"
        value={password}
      >
        <Label className="font-medium text-[13px]">{label}</Label>
        <Input />
        <Description>
          At least {PASSWORD_MIN_LENGTH} characters. A few unrelated words make
          a strong one.
        </Description>
        <FieldError />
      </TextField>
      <TextField
        autoComplete="new-password"
        className="flex flex-col gap-1.5"
        isRequired
        name="confirm-password"
        onChange={onConfirmationChange}
        type="password"
        validate={(value) =>
          value && value !== password ? "The two passwords don't match" : null
        }
        value={confirmation}
      >
        <Label className="font-medium text-[13px]">Type it again</Label>
        <Input />
        <FieldError />
      </TextField>
    </>
  );
}
