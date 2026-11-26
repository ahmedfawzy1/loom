"use client";

import {
  Button,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
  toast,
} from "@heroui/react";
import type { SpaceResponseDto } from "@loom/dto";
import type { Site, Space } from "@loom/dto/models";
import { FormField } from "@loom-web/src/components/content/FormField";
import { SettingsPanel } from "@loom-web/src/components/settings/SettingsPanel";
import { Notice } from "@loom-web/src/components/ui/Notice";
import { Section } from "@loom-web/src/components/ui/Section";
import {
  useCreateSpace,
  useDeleteSpace,
  useRenameSpace,
} from "@loom-web/src/hooks/site/useSpaceQueries";
import { Plus, Trash } from "@phosphor-icons/react";
import { useState } from "react";

const START_EMPTY = "start-empty";

function SpaceRow({
  space,
  canDelete,
}: {
  space: Serialized<SpaceResponseDto>;
  canDelete: boolean;
}) {
  const renameSpace = useRenameSpace();
  const deleteSpace = useDeleteSpace();
  const [name, setName] = useState<Space["name"]>(space.name);
  const [confirmName, setConfirmName] = useState<Space["name"]>("");
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <li className="flex flex-col gap-3 border-separator border-b px-5 py-3.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <TextField
          aria-label={`Name of ${space.name}`}
          className="max-w-xs flex-1"
          onChange={setName}
          value={name}
        >
          <Input />
        </TextField>
        <code className="truncate font-mono text-muted text-xs">
          {space.slug}
        </code>
        <div className="ms-auto flex shrink-0 items-center gap-1">
          <Button
            isDisabled={renameSpace.isPending || name === space.name}
            onPress={() =>
              renameSpace.mutate(
                { spaceId: space.id, name },
                {
                  onSuccess: () => toast.success("Space renamed"),
                  onError: (error) => toast.danger(error.message),
                },
              )
            }
            size="sm"
            variant="secondary"
          >
            Rename
          </Button>
          {canDelete && (
            <Button
              aria-label={`Delete ${space.name}`}
              isIconOnly
              onPress={() => setIsDeleting((previous) => !previous)}
              size="sm"
              variant="ghost"
            >
              <Trash className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {isDeleting && (
        <Notice
          actions={
            <>
              <Button
                isDisabled={deleteSpace.isPending || confirmName !== space.name}
                onPress={() =>
                  deleteSpace.mutate(
                    { spaceId: space.id, confirmName },
                    {
                      onSuccess: () => toast.success(`${space.name} deleted`),
                      onError: (error) => toast.danger(error.message),
                    },
                  )
                }
                size="sm"
                variant="danger"
              >
                Delete permanently
              </Button>
              <Button
                onPress={() => setIsDeleting(false)}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </>
          }
          title={`Delete ${space.name} and everything in it?`}
          tone="warning"
        >
          <TextField
            className="mt-1 flex max-w-xs flex-col gap-1.5"
            onChange={setConfirmName}
            value={confirmName}
          >
            <Label className="text-[13px]">
              Type “{space.name}” to confirm
            </Label>
            <Input />
          </TextField>
        </Notice>
      )}
    </li>
  );
}

function CreateSpace({
  siteId,
  spaces,
}: {
  siteId: Site["id"];
  spaces: Serialized<SpaceResponseDto>[];
}) {
  const createSpace = useCreateSpace();
  const [name, setName] = useState<Space["name"]>("");
  const [source, setSource] = useState<Space["id"] | typeof START_EMPTY>(
    START_EMPTY,
  );

  return (
    <Section
      description="Start empty, or clone an existing Space with everything in it."
      title="New space"
    >
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <FormField
            label="Name"
            onChange={setName}
            placeholder="Staging"
            value={name}
          />
        </div>

        <Select
          className="flex min-w-48 flex-col gap-1.5"
          onChange={(key) => {
            const selected = Array.isArray(key) ? key[0] : key;
            if (selected) setSource(String(selected));
          }}
          value={source}
        >
          <Label className="font-medium text-[13px]">Content</Label>
          <Select.Trigger>
            <Select.Value className="text-sm" />
            <Select.Indicator className="text-muted" />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id={START_EMPTY} textValue="Start empty">
                Start empty
              </ListBox.Item>
              {spaces.map((space) => (
                <ListBox.Item
                  id={space.id}
                  key={space.id}
                  textValue={`Clone ${space.name}`}
                >
                  Clone {space.name}
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Button
          isDisabled={createSpace.isPending || !name.trim()}
          onPress={() =>
            createSpace.mutate(
              {
                siteId,
                name: name.trim(),
                cloneFromSpaceId: source === START_EMPTY ? undefined : source,
              },
              {
                onSuccess: () => {
                  setName("");
                  toast.success("Space created");
                },
                onError: (error) => toast.danger(error.message),
              },
            )
          }
        >
          <Plus className="size-4" weight="bold" />
          {createSpace.isPending ? "Creating…" : "Create"}
        </Button>
      </div>
    </Section>
  );
}

export function SpacesPanel() {
  return (
    <SettingsPanel>
      {(site) => (
        <>
          <Section
            bodyClassName="gap-0 px-0 pb-0"
            description="The website asks for a Space by its slug, which never changes. Renaming changes only the name shown here."
            title={`${site.spaces.length} space${site.spaces.length === 1 ? "" : "s"}`}
          >
            <ul className="border-border border-t">
              {site.spaces.map((space) => (
                <SpaceRow
                  canDelete={site.spaces.length > 1}
                  key={space.id}
                  space={space}
                />
              ))}
            </ul>
          </Section>
          <CreateSpace siteId={site.id} spaces={site.spaces} />
        </>
      )}
    </SettingsPanel>
  );
}
