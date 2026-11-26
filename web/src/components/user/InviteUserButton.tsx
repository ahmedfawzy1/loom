"use client";

import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  TextField,
} from "@heroui/react";
import type { InvitedUserResponseDto } from "@loom/dto";
import { EMAIL_MAX_LENGTH, USER_NAME_MAX_LENGTH } from "@loom/dto/constants";
import { CmsRole } from "@loom/dto/models";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { PasswordLinkNotice } from "@loom-web/src/components/user/PasswordLinkNotice";
import { ROLE_LABELS, ROLE_SUMMARIES } from "@loom-web/src/constants/roles";
import { useInviteUser } from "@loom-web/src/hooks/user/useUserQueries";
import { Plus } from "@phosphor-icons/react";
import { useState } from "react";

type Invited = Serialized<InvitedUserResponseDto>;

function InviteForm({
  onInvited,
  onCancel,
}: {
  onInvited: (invited: Invited) => void;
  onCancel: () => void;
}) {
  const invite = useInviteUser();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  // The narrowest role, so a slip of the hand grants the least
  const [role, setRole] = useState<CmsRole>(CmsRole.WRITER);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (invite.isPending) return;
        invite.mutate(
          { email, name: name.trim() || undefined, role },
          { onSuccess: onInvited },
        );
      }}
    >
      <Modal.Body className="flex flex-col gap-4 px-5 py-4">
        <TextField
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
          <Input placeholder="name@example.com" />
          <FieldError />
        </TextField>
        <TextField
          className="flex flex-col gap-1.5"
          maxLength={USER_NAME_MAX_LENGTH}
          name="name"
          onChange={setName}
          value={name}
        >
          <Label className="font-medium text-[13px]">
            Name <span className="font-normal text-muted">(optional)</span>
          </Label>
          <Input />
        </TextField>
        <Select
          className="flex flex-col gap-1.5"
          onChange={(key) => {
            const selected = Array.isArray(key) ? key[0] : key;
            if (selected) setRole(String(selected) as CmsRole);
          }}
          value={role}
        >
          <Label className="font-medium text-[13px]">Role</Label>
          <Select.Trigger>
            <Select.Value className="truncate text-sm" />
            <Select.Indicator className="text-muted" />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {Object.values(CmsRole).map((option) => (
                <ListBox.Item
                  id={option}
                  key={option}
                  textValue={ROLE_LABELS[option]}
                >
                  {ROLE_LABELS[option]}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
          <Description>{ROLE_SUMMARIES[role]}</Description>
        </Select>
        {invite.error && <ErrorText message={invite.error.message} />}
      </Modal.Body>
      <Modal.Footer className="flex justify-end gap-2 border-border border-t px-5 py-4">
        <Button onPress={onCancel} variant="ghost">
          Cancel
        </Button>
        <Button isDisabled={invite.isPending} type="submit">
          {invite.isPending ? "Adding…" : "Add user"}
        </Button>
      </Modal.Footer>
    </form>
  );
}

/**
 * Adding someone: their email and role, then the link they need to choose a password. Accounts
 * exist only this way — nobody can sign up.
 */
export function InviteUserButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [invited, setInvited] = useState<Invited>();
  // Reset on the way in rather than out, so the dialog keeps what it shows while it fades away
  const open = () => {
    setInvited(undefined);
    setIsOpen(true);
  };
  const close = () => setIsOpen(false);

  return (
    <>
      <Button onPress={open}>
        <Plus className="size-4" weight="bold" />
        Add user
      </Button>
      <Modal.Backdrop
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <Modal.Container className="w-full" placement="center">
          <Modal.Dialog className="max-w-md rounded-xl p-0">
            <Modal.CloseTrigger />
            <Modal.Header className="border-border border-b px-5 py-4">
              <Modal.Heading className="font-semibold text-base">
                {invited ? "User added" : "Add a user"}
              </Modal.Heading>
              <p className="text-muted text-sm">
                {invited
                  ? `${invited.user.email} can sign in once they choose a password.`
                  : "They'll get a link to choose a password. People can't sign up on their own."}
              </p>
            </Modal.Header>
            {invited ? (
              <Modal.Body className="px-5 py-4">
                <PasswordLinkNotice
                  isInvite
                  link={invited.link}
                  name={invited.user.name ?? invited.user.email}
                  onDismiss={close}
                />
              </Modal.Body>
            ) : (
              <InviteForm onCancel={close} onInvited={setInvited} />
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
