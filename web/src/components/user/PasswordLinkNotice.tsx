"use client";

import { Button } from "@heroui/react";
import type { PasswordLinkResponseDto } from "@loom/dto";
import { SET_PASSWORD_PATH } from "@loom/dto/constants";
import { Code } from "@loom-web/src/components/ui/Code";
import { CopyButton } from "@loom-web/src/components/ui/CopyButton";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { formatDateTime } from "@loom-web/src/lib/format/date";

/** The page a link opens on this admin app, with its token where only the browser reads it. */
const linkUrl = (token: string) =>
  `${window.location.origin}${SET_PASSWORD_PATH}#token=${encodeURIComponent(token)}`;

/**
 * A password link to send someone, shown the one time it can be: only a hash of it is stored.
 * Anyone holding it can set the password, so it goes to that person alone.
 */
export function PasswordLinkNotice({
  link,
  name,
  isInvite,
  onDismiss,
}: {
  link: Serialized<PasswordLinkResponseDto>;
  name: string;
  isInvite: boolean;
  onDismiss: () => void;
}) {
  const url = linkUrl(link.token);

  return (
    <Notice
      actions={
        <>
          <CopyButton label="Copy link" text={url} />
          <Button onPress={onDismiss} size="sm" variant="ghost">
            Done
          </Button>
        </>
      }
      title={`Send ${name} this link`}
      tone="warning"
    >
      {isInvite
        ? "They open it to choose a password, which activates their account."
        : "They open it to choose a new password. Their current one works until then."}{" "}
      It works once, until {formatDateTime(link.expiresAt)}, and can't be shown
      again — make a new one if it's lost.
      <div className="mt-2">
        <Code>{url}</Code>
      </div>
    </Notice>
  );
}
