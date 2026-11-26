"use client";

import { Button, cn, ListBox, Select, toast } from "@heroui/react";
import type { CmsUserResponseDto, PasswordLinkResponseDto } from "@loom/dto";
import { CmsRole, type CmsUser, CmsUserStatus } from "@loom/dto/models";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { LoadingRows } from "@loom-web/src/components/ui/LoadingRows";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { StatusChip } from "@loom-web/src/components/ui/StatusChip";
import { PasswordLinkNotice } from "@loom-web/src/components/user/PasswordLinkNotice";
import { ROLE_LABELS } from "@loom-web/src/constants/roles";
import {
  useCreatePasswordLink,
  useDeleteUser,
  useUpdateUserRole,
  useUpdateUserStatus,
  useUsers,
} from "@loom-web/src/hooks/user/useUserQueries";
import { formatDateTime, formatRelative } from "@loom-web/src/lib/format/date";
import { LockSimple, Trash, UsersThree } from "@phosphor-icons/react";
import { useState } from "react";

type User = Serialized<CmsUserResponseDto>;

const COLUMNS = 6;

function RolePicker({ user, isLocked }: { user: User; isLocked: boolean }) {
  const updateRole = useUpdateUserRole();

  return (
    <Select
      aria-label={`Role for ${user.email}`}
      className="w-36"
      isDisabled={isLocked || updateRole.isPending}
      onChange={(key) => {
        const selected = Array.isArray(key) ? key[0] : key;
        if (!selected || selected === user.role) return;
        const role = String(selected) as CmsUser["role"];
        updateRole.mutate(
          { userId: user.id, role },
          {
            onSuccess: () =>
              toast.success(
                `${user.name ?? user.email} is now ${ROLE_LABELS[role]}`,
              ),
            onError: (error) => toast.danger(error.message),
          },
        );
      }}
      value={user.role}
    >
      <Select.Trigger className="h-8 min-h-8 items-center py-0">
        <Select.Value className="truncate text-sm" />
        <Select.Indicator className="text-muted" />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {Object.values(CmsRole).map((role) => (
            <ListBox.Item id={role} key={role} textValue={ROLE_LABELS[role]}>
              {ROLE_LABELS[role]}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/** Where an invite stands: an invited account can only be used through the link it was sent. */
function InviteState({ user }: { user: User }) {
  if (user.status !== CmsUserStatus.PENDING) return null;

  const expiresAt = user.passwordLinkExpiresAt;
  if (!expiresAt)
    return <span className="text-muted text-xs">No link — make one</span>;

  const isExpired = new Date(expiresAt) <= new Date();
  return (
    <span
      className={cn(
        "whitespace-nowrap text-xs",
        isExpired ? "text-danger-soft-foreground" : "text-muted",
      )}
      title={formatDateTime(expiresAt)}
    >
      {isExpired ? "Link expired" : `Link expires ${formatRelative(expiresAt)}`}
    </span>
  );
}

function UserRow({
  user,
  isSoleAdmin,
}: {
  user: User;
  /** The only active Admin: the API refuses to demote, disable or delete them, so nothing is offered. */
  isSoleAdmin: boolean;
}) {
  const updateStatus = useUpdateUserStatus();
  const deleteUser = useDeleteUser();
  const createLink = useCreatePasswordLink();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [link, setLink] = useState<Serialized<PasswordLinkResponseDto>>();

  const isDisabled = user.status === CmsUserStatus.DISABLED;
  const isInvited = user.status === CmsUserStatus.PENDING;
  const name = user.name ?? user.email;

  return (
    <>
      <tr
        className={cn(
          "border-separator border-b transition-colors duration-fast last:border-b-0 hover:bg-surface-secondary",
          (confirmingDelete || link) && "border-b-0",
        )}
      >
        <td className="max-w-0 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-soft-foreground text-xs uppercase",
                isDisabled && "bg-surface-tertiary text-muted",
              )}
            >
              {name.charAt(0)}
            </span>
            {/* The whole email on hover, for when the column cuts it short */}
            <div className="flex min-w-0 flex-col" title={user.email}>
              <span className="truncate font-medium">{name}</span>
              {user.name && (
                <span className="truncate text-muted text-xs">
                  {user.email}
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5">
          <RolePicker isLocked={isSoleAdmin} user={user} />
        </td>
        <td className="px-4 py-2.5">
          <div className="flex flex-col items-start gap-1">
            <StatusChip status={user.status} />
            <InviteState user={user} />
          </div>
        </td>
        <td
          className="px-4 py-2.5 text-muted text-xs"
          title={formatDateTime(user.createdAt)}
        >
          {formatRelative(user.createdAt)}
        </td>
        <td
          className="px-4 py-2.5 text-muted text-xs"
          title={user.lastActiveAt ? formatDateTime(user.lastActiveAt) : ""}
        >
          {user.lastActiveAt ? formatRelative(user.lastActiveAt) : "Never"}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center justify-end gap-1">
            {isSoleAdmin && (
              <span className="flex items-center gap-1.5 px-2 text-muted text-xs">
                <LockSimple className="size-3.5" />
                Only Admin
              </span>
            )}
            {!isSoleAdmin && (
              <>
                {!isDisabled && (
                  <Button
                    isDisabled={createLink.isPending || Boolean(link)}
                    onPress={() =>
                      createLink.mutate(user.id, {
                        onSuccess: (created) => {
                          setConfirmingDelete(false);
                          setLink(created);
                        },
                        onError: (error) => toast.danger(error.message),
                      })
                    }
                    size="sm"
                    variant="ghost"
                  >
                    {isInvited ? "New link" : "Reset password"}
                  </Button>
                )}
                <Button
                  isDisabled={updateStatus.isPending}
                  onPress={() =>
                    updateStatus.mutate(
                      {
                        userId: user.id,
                        status: isDisabled
                          ? CmsUserStatus.ACTIVE
                          : CmsUserStatus.DISABLED,
                      },
                      {
                        onSuccess: () => {
                          // Disabling voids the link, so there is no point showing it
                          if (!isDisabled) setLink(undefined);
                          toast.success(
                            `${name} ${isDisabled ? "reactivated" : "disabled"}`,
                          );
                        },
                        onError: (error) => toast.danger(error.message),
                      },
                    )
                  }
                  size="sm"
                  variant="ghost"
                >
                  {isDisabled ? "Reactivate" : "Disable"}
                </Button>
                <Button
                  aria-label={`Delete ${name}`}
                  isDisabled={confirmingDelete}
                  isIconOnly
                  onPress={() => {
                    setLink(undefined);
                    setConfirmingDelete(true);
                  }}
                  size="sm"
                  variant="ghost"
                >
                  <Trash className="size-4" />
                </Button>
              </>
            )}
          </div>
        </td>
      </tr>
      {link && (
        <tr className="border-separator border-b last:border-b-0">
          <td className="px-4 pb-3" colSpan={COLUMNS}>
            <PasswordLinkNotice
              isInvite={isInvited}
              link={link}
              name={name}
              onDismiss={() => setLink(undefined)}
            />
          </td>
        </tr>
      )}
      {confirmingDelete && (
        <tr className="border-separator border-b last:border-b-0">
          <td className="px-4 pb-3" colSpan={COLUMNS}>
            <Notice
              actions={
                <>
                  <Button
                    isDisabled={deleteUser.isPending}
                    onPress={() =>
                      deleteUser.mutate(user.id, {
                        onSuccess: () => toast.success(`${name} deleted`),
                        onError: (error) => {
                          setConfirmingDelete(false);
                          toast.danger(error.message);
                        },
                      })
                    }
                    size="sm"
                    variant="danger"
                  >
                    Delete user
                  </Button>
                  <Button
                    onPress={() => setConfirmingDelete(false)}
                    size="sm"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </>
              }
              title={`Delete ${name}?`}
              tone="warning"
            >
              Their account, role and password are removed from Loom, and they
              are signed out.
            </Notice>
          </td>
        </tr>
      )}
    </>
  );
}

export function UsersTable() {
  const { data: users, isPending, error } = useUsers();

  // The site must keep one Admin who can still sign in
  const admins = (users ?? []).filter(
    (user) =>
      user.role === CmsRole.ADMIN && user.status === CmsUserStatus.ACTIVE,
  );
  const soleAdminId = admins.length === 1 ? admins[0]?.id : undefined;

  const body = () => {
    if (isPending) return <LoadingRows />;
    if (error)
      return (
        <div className="px-4 py-6">
          <ErrorText message={error.message} />
        </div>
      );
    if (!users.length)
      return (
        <EmptyState icon={UsersThree} title="No one yet">
          Add someone with Add user.
        </EmptyState>
      );

    return (
      <table className="w-full text-sm">
        <thead className="border-border border-b text-muted text-xs">
          <tr>
            <th className="px-4 py-2.5 text-start font-medium">User</th>
            <th className="w-44 px-4 py-2.5 text-start font-medium">Role</th>
            <th className="w-40 px-4 py-2.5 text-start font-medium">Status</th>
            <th className="w-32 px-4 py-2.5 text-start font-medium">Added</th>
            <th className="w-32 px-4 py-2.5 text-start font-medium">
              Last active
            </th>
            <th className="w-64 px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <UserRow
              isSoleAdmin={soleAdminId === user.id}
              key={user.id}
              user={user}
            />
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {body()}
    </div>
  );
}
