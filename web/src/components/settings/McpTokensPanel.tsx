"use client";

import { Button, cn, Input, Label, TextField, toast } from "@heroui/react";
import type {
  CreatedMcpTokenResponseDto,
  McpTokenResponseDto,
} from "@loom/dto";
import {
  MCP_TOKEN_NAME_MAX_LENGTH,
  MCP_TOKEN_TTL_DAYS,
} from "@loom/dto/constants";
import type { McpToken } from "@loom/dto/models";
import { Code } from "@loom-web/src/components/ui/Code";
import { CopyButton } from "@loom-web/src/components/ui/CopyButton";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { LoadingRows } from "@loom-web/src/components/ui/LoadingRows";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { Pill } from "@loom-web/src/components/ui/Pill";
import { Section } from "@loom-web/src/components/ui/Section";
import {
  useCreateMcpToken,
  useMcpTokens,
  useRevokeMcpToken,
} from "@loom-web/src/hooks/user/useMcpTokens";
import {
  formatDate,
  formatDateTime,
  formatRelative,
} from "@loom-web/src/lib/format/date";
import { PlugsConnected, Plus } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

/** Where an assistant connects: this origin, which forwards /mcp to the API the way it does /admin. */
function useMcpUrl() {
  const [url, setUrl] = useState("/mcp");
  useEffect(() => setUrl(`${window.location.origin}/mcp`), []);
  return url;
}

const claudeCodeCommand = (url: string, token: string) =>
  `claude mcp add --transport http loom ${url} --header "Authorization: Bearer ${token}"`;

function NewToken({
  created,
  url,
  onDismiss,
}: {
  created: Serialized<CreatedMcpTokenResponseDto>;
  url: string;
  onDismiss: () => void;
}) {
  const command = claudeCodeCommand(url, created.token);

  return (
    <Notice
      actions={
        <>
          <CopyButton label="Copy token" text={created.token} />
          <CopyButton label="Copy command" text={command} />
          <Button onPress={onDismiss} size="sm" variant="ghost">
            Done
          </Button>
        </>
      }
      title={`Copy ${created.name} now`}
      tone="warning"
    >
      Only a hash is stored, so it can't be shown again. A lost token is revoked
      and replaced.
      <div className="mt-2 flex flex-col gap-2">
        <Code>{created.token}</Code>
        <p>To add it to Claude Code, run:</p>
        <Code>{command}</Code>
      </div>
    </Notice>
  );
}

function CreateTokenForm({ url }: { url: string }) {
  const createToken = useCreateMcpToken();
  const [name, setName] = useState<McpToken["name"]>("");
  const [created, setCreated] =
    useState<Serialized<CreatedMcpTokenResponseDto>>();

  if (created)
    return (
      <NewToken
        created={created}
        onDismiss={() => setCreated(undefined)}
        url={url}
      />
    );

  return (
    <div className="flex items-end gap-3">
      <TextField
        className="flex flex-1 flex-col gap-1.5"
        maxLength={MCP_TOKEN_NAME_MAX_LENGTH}
        onChange={setName}
        value={name}
      >
        <Label className="font-medium text-[13px]">Name</Label>
        <Input placeholder="Claude Code on my laptop" />
      </TextField>
      <Button
        isDisabled={!name.trim() || createToken.isPending}
        onPress={() =>
          createToken.mutate(
            { name: name.trim() },
            {
              onSuccess: (token) => {
                setCreated(token);
                setName("");
              },
              onError: (error) => toast.danger(error.message),
            },
          )
        }
      >
        <Plus className="size-4" weight="bold" />
        Create token
      </Button>
    </div>
  );
}

function TokenRow({ token }: { token: Serialized<McpTokenResponseDto> }) {
  const revoke = useRevokeMcpToken();
  const [isConfirming, setIsConfirming] = useState(false);
  const isRevoked = Boolean(token.revokedAt);
  const isExpired = !isRevoked && new Date(token.expiresAt) <= new Date();
  const isDead = isRevoked || isExpired;

  return (
    <>
      <tr
        className={cn(
          "border-separator border-b transition-colors duration-fast last:border-b-0 hover:bg-surface-secondary",
          isConfirming && "border-b-0",
        )}
      >
        <td className={cn("max-w-0 px-4 py-2.5", isDead && "opacity-60")}>
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{token.name}</span>
            <span className="shrink-0 font-mono text-muted text-xs">
              {token.tokenPrefix}…
            </span>
          </div>
          <p
            className="truncate text-muted text-xs"
            title={formatDateTime(token.createdAt)}
          >
            Created {formatRelative(token.createdAt)}
          </p>
        </td>
        <td
          className={cn(
            "px-4 py-2.5 text-muted text-xs",
            isDead && "opacity-60",
          )}
          title={formatDateTime(token.expiresAt)}
        >
          {formatDate(token.expiresAt)}
        </td>
        <td
          className={cn(
            "px-4 py-2.5 text-muted text-xs",
            isDead && "opacity-60",
          )}
          title={token.lastUsedAt ? formatDateTime(token.lastUsedAt) : ""}
        >
          {token.lastUsedAt ? formatRelative(token.lastUsedAt) : "Never"}
        </td>
        <td className="px-4 py-2.5 text-end">
          {token.revokedAt ? (
            <span title={formatDateTime(token.revokedAt)}>
              <Pill tone="danger">Revoked</Pill>
            </span>
          ) : isExpired ? (
            <Pill tone="neutral">Expired</Pill>
          ) : (
            <Button
              isDisabled={isConfirming}
              onPress={() => setIsConfirming(true)}
              size="sm"
              variant="ghost"
            >
              Revoke
            </Button>
          )}
        </td>
      </tr>
      {isConfirming && !isDead && (
        <tr className="border-separator border-b last:border-b-0">
          <td className="px-4 pb-3" colSpan={4}>
            <Notice
              actions={
                <>
                  <Button
                    isDisabled={revoke.isPending}
                    onPress={() =>
                      revoke.mutate(token.id, {
                        onSuccess: () => toast.success(`${token.name} revoked`),
                        onError: (error) => toast.danger(error.message),
                      })
                    }
                    size="sm"
                    variant="danger"
                  >
                    Revoke token
                  </Button>
                  <Button
                    onPress={() => setIsConfirming(false)}
                    size="sm"
                    variant="ghost"
                  >
                    Cancel
                  </Button>
                </>
              }
              title={`Revoke ${token.name}?`}
              tone="warning"
            >
              The assistant using it is disconnected at once. This can't be
              undone.
            </Notice>
          </td>
        </tr>
      )}
    </>
  );
}

export function McpTokensPanel() {
  const url = useMcpUrl();
  const { data: tokens, isPending, error } = useMcpTokens();

  const list = () => {
    if (isPending) return <LoadingRows rows={3} />;
    if (error)
      return (
        <div className="px-4 py-6">
          <ErrorText message={error.message} />
        </div>
      );
    if (!tokens.length)
      return (
        <EmptyState icon={PlugsConnected} title="No tokens yet">
          Create one for each place you connect an assistant from.
        </EmptyState>
      );

    return (
      <table className="w-full text-sm">
        <thead className="border-border border-b text-muted text-xs">
          <tr>
            <th className="px-4 py-2.5 text-start font-medium">Token</th>
            <th className="w-32 px-4 py-2.5 text-start font-medium">Expires</th>
            <th className="w-32 px-4 py-2.5 text-start font-medium">
              Last used
            </th>
            <th className="w-28 px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {tokens.map((token) => (
            <TokenRow key={token.id} token={token} />
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <>
      <Section
        description="Add Loom to an MCP client as a remote (HTTP) server, with your token in an Authorization header."
        title="Connect"
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <Code>{url}</Code>
          </div>
          <CopyButton text={url} />
        </div>
        <p className="text-muted text-xs leading-5">
          Claude Code:{" "}
          <code className="font-mono text-foreground">
            {claudeCodeCommand(url, "<token>")}
          </code>
          . Other clients take the same URL and{" "}
          <code className="font-mono text-foreground">
            Authorization: Bearer &lt;token&gt;
          </code>
          .
        </p>
      </Section>

      <Section
        description={`A token works for ${MCP_TOKEN_TTL_DAYS} days, or until you revoke it.`}
        title="New token"
      >
        <CreateTokenForm url={url} />
      </Section>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {list()}
      </div>
    </>
  );
}
