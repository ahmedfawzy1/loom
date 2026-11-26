"use client";

import {
  Button,
  Checkbox,
  cn,
  Input,
  Label,
  TextField,
  toast,
} from "@heroui/react";
import type {
  ApiKeyResponseDto,
  CreatedApiKeyResponseDto,
  SiteResponseDto,
} from "@loom/dto";
import {
  API_KEY_NAME_MAX_LENGTH,
  API_KEY_RATE_LIMIT_MAX,
} from "@loom/dto/constants";
import type { ApiKey } from "@loom/dto/models";
import { SettingsPanel } from "@loom-web/src/components/settings/SettingsPanel";
import { EmptyState } from "@loom-web/src/components/ui/EmptyState";
import { ErrorText } from "@loom-web/src/components/ui/ErrorText";
import { LoadingRows } from "@loom-web/src/components/ui/LoadingRows";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { Pill } from "@loom-web/src/components/ui/Pill";
import { Section } from "@loom-web/src/components/ui/Section";
import {
  useApiKeys,
  useCreateApiKey,
  useRevokeApiKey,
} from "@loom-web/src/hooks/site/useApiKeys";
import { formatDateTime, formatRelative } from "@loom-web/src/lib/format/date";
import { useContextStore } from "@loom-web/src/stores/context";
import { Copy, Key, Plus } from "@phosphor-icons/react";
import { useState } from "react";

// Matches the schema's default
const DEFAULT_RATE_LIMIT = 600;

function NewKey({
  created,
  onDismiss,
}: {
  created: Serialized<CreatedApiKeyResponseDto>;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Notice
      actions={
        <>
          <Button
            onPress={async () => {
              await navigator.clipboard.writeText(created.key);
              setCopied(true);
            }}
            size="sm"
            variant="secondary"
          >
            <Copy className="size-4" />
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button onPress={onDismiss} size="sm" variant="ghost">
            Done
          </Button>
        </>
      }
      title={`Copy ${created.name} now`}
      tone="warning"
    >
      Only a hash is stored, so it can't be shown again. A lost key is revoked
      and replaced.
      <code className="mt-2 block select-all overflow-x-auto rounded-md border border-border bg-surface px-3 py-2 font-mono text-foreground text-xs">
        {created.key}
      </code>
    </Notice>
  );
}

function CreateKeyForm({ site }: { site: Serialized<SiteResponseDto> }) {
  const createKey = useCreateApiKey();
  const [name, setName] = useState<ApiKey["name"]>("");
  const [rateLimit, setRateLimit] = useState(String(DEFAULT_RATE_LIMIT));
  const [canPreview, setCanPreview] = useState<ApiKey["canPreview"]>(false);
  const [created, setCreated] =
    useState<Serialized<CreatedApiKeyResponseDto>>();

  const limit = Number(rateLimit);
  const isValid =
    name.trim().length > 0 &&
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= API_KEY_RATE_LIMIT_MAX;

  if (created)
    return <NewKey created={created} onDismiss={() => setCreated(undefined)} />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-3">
        <TextField
          className="flex flex-1 flex-col gap-1.5"
          maxLength={API_KEY_NAME_MAX_LENGTH}
          onChange={setName}
          value={name}
        >
          <Label className="font-medium text-[13px]">Name</Label>
          <Input
            placeholder={
              canPreview ? "example.com preview" : "example.com production"
            }
          />
        </TextField>
        <TextField
          className="flex w-40 flex-col gap-1.5"
          onChange={setRateLimit}
          value={rateLimit}
        >
          <Label className="font-medium text-[13px]">Requests per minute</Label>
          <Input className="tabular-nums" inputMode="numeric" />
        </TextField>
        <Button
          isDisabled={!isValid || createKey.isPending}
          onPress={() =>
            createKey.mutate(
              {
                siteId: site.id,
                args: {
                  name: name.trim(),
                  rateLimitPerMinute: limit,
                  canPreview,
                },
              },
              {
                onSuccess: (key) => {
                  setCreated(key);
                  setName("");
                  setRateLimit(String(DEFAULT_RATE_LIMIT));
                  setCanPreview(false);
                },
                onError: (error) => toast.danger(error.message),
              },
            )
          }
        >
          <Plus className="size-4" weight="bold" />
          Create key
        </Button>
      </div>
      <Checkbox isSelected={canPreview} onChange={setCanPreview}>
        <Checkbox.Content className="flex-row items-start gap-3">
          <Checkbox.Control className="mt-0.5">
            <Checkbox.Indicator />
          </Checkbox.Control>
          <span className="flex flex-col gap-0.5">
            <span className="font-medium text-sm">Can read drafts</span>
            <span className="text-muted text-xs">
              For the website's draft mode only: with{" "}
              <code className="font-mono">preview=true</code> it sees everything
              saved, published or not. Give production its own key without this.
            </span>
          </span>
        </Checkbox.Content>
      </Checkbox>
    </div>
  );
}

function KeyRow({ apiKey }: { apiKey: Serialized<ApiKeyResponseDto> }) {
  const revoke = useRevokeApiKey();
  const [isConfirming, setIsConfirming] = useState(false);
  const isRevoked = Boolean(apiKey.revokedAt);

  return (
    <>
      <tr
        className={cn(
          "border-separator border-b transition-colors duration-fast last:border-b-0 hover:bg-surface-secondary",
          isConfirming && "border-b-0",
        )}
      >
        <td className={cn("max-w-0 px-4 py-2.5", isRevoked && "opacity-60")}>
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{apiKey.name}</span>
            <span className="shrink-0 font-mono text-muted text-xs">
              {apiKey.keyPrefix}…
            </span>
            {apiKey.canPreview && (
              <span title="This key can read drafts with preview=true">
                <Pill tone="warning">Reads drafts</Pill>
              </span>
            )}
          </div>
          <p
            className="truncate text-muted text-xs"
            title={formatDateTime(apiKey.createdAt)}
          >
            Created {formatRelative(apiKey.createdAt)}
            {apiKey.createdBy &&
              ` by ${apiKey.createdBy.name ?? apiKey.createdBy.email}`}
          </p>
        </td>
        <td
          className={cn(
            "px-4 py-2.5 text-muted text-xs tabular-nums",
            isRevoked && "opacity-60",
          )}
        >
          {apiKey.rateLimitPerMinute.toLocaleString()}/min
        </td>
        <td
          className={cn(
            "px-4 py-2.5 text-muted text-xs",
            isRevoked && "opacity-60",
          )}
          title={apiKey.lastUsedAt ? formatDateTime(apiKey.lastUsedAt) : ""}
        >
          {apiKey.lastUsedAt ? formatRelative(apiKey.lastUsedAt) : "Never"}
        </td>
        <td className="px-4 py-2.5 text-end">
          {apiKey.revokedAt ? (
            <span title={formatDateTime(apiKey.revokedAt)}>
              <Pill tone="danger">Revoked</Pill>
            </span>
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
      {isConfirming && !isRevoked && (
        <tr className="border-separator border-b last:border-b-0">
          <td className="px-4 pb-3" colSpan={4}>
            <Notice
              actions={
                <>
                  <Button
                    isDisabled={revoke.isPending}
                    onPress={() =>
                      revoke.mutate(apiKey.id, {
                        onSuccess: () =>
                          toast.success(`${apiKey.name} revoked`),
                        onError: (error) => toast.danger(error.message),
                      })
                    }
                    size="sm"
                    variant="danger"
                  >
                    Revoke key
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
              title={`Revoke ${apiKey.name}?`}
              tone="warning"
            >
              Anything still using it stops getting content at once. This can't
              be undone.
            </Notice>
          </td>
        </tr>
      )}
    </>
  );
}

function ApiKeys({ site }: { site: Serialized<SiteResponseDto> }) {
  const spaceId = useContextStore((state) => state.spaceId);
  const { data: keys, isPending, error } = useApiKeys(site.id);

  const space =
    site.spaces.find((candidate) => candidate.id === spaceId) ?? site.spaces[0];

  const list = () => {
    if (isPending) return <LoadingRows rows={3} />;
    if (error)
      return (
        <div className="px-4 py-6">
          <ErrorText message={error.message} />
        </div>
      );
    if (!keys.length)
      return (
        <EmptyState icon={Key} title="No keys yet">
          The Content API refuses every request until one exists.
        </EmptyState>
      );

    return (
      <table className="w-full text-sm">
        <thead className="border-border border-b text-muted text-xs">
          <tr>
            <th className="px-4 py-2.5 text-start font-medium">Key</th>
            <th className="w-24 px-4 py-2.5 text-start font-medium">Limit</th>
            <th className="w-32 px-4 py-2.5 text-start font-medium">
              Last used
            </th>
            <th className="w-28 px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {keys.map((apiKey) => (
            <KeyRow apiKey={apiKey} key={apiKey.id} />
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <>
      <Section
        description={`A key reads every Space of ${site.name}, and nothing of any other site.`}
        title="New key"
      >
        <CreateKeyForm site={site} />
        <p className="text-muted text-xs leading-5">
          Send it from the website's server, never the browser:{" "}
          <code className="font-mono text-foreground">
            {`GET /content/${site.slug}/${space?.slug ?? "{space}"}/blogs?locale=en`}
          </code>{" "}
          with{" "}
          <code className="font-mono text-foreground">
            Authorization: Bearer …
          </code>
        </p>
      </Section>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {list()}
      </div>
    </>
  );
}

export function ApiKeysPanel() {
  return <SettingsPanel>{(site) => <ApiKeys site={site} />}</SettingsPanel>;
}
