import { CmsUserStatus, LocaleStatus } from "@loom/dto/models";
import { Pill, type PillTone } from "@loom-web/src/components/ui/Pill";

/** A language with no version at all — not a status the API stores, but one every list shows. */
export const MISSING = "MISSING";

type Status = CmsUserStatus | LocaleStatus | typeof MISSING;

const STATUSES: Record<Status, { label: string; tone: PillTone }> = {
  // Added by an Admin, and has not chosen a password yet
  [CmsUserStatus.PENDING]: { label: "Invited", tone: "warning" },
  [CmsUserStatus.ACTIVE]: { label: "Active", tone: "success" },
  [CmsUserStatus.DISABLED]: { label: "Disabled", tone: "danger" },
  [LocaleStatus.DRAFT]: { label: "Draft", tone: "neutral" },
  [LocaleStatus.IN_REVIEW]: { label: "In review", tone: "review" },
  [LocaleStatus.PUBLISHED]: { label: "Published", tone: "success" },
  [LocaleStatus.CHANGED]: { label: "Changed", tone: "warning" },
  [LocaleStatus.UNPUBLISHED]: { label: "Unpublished", tone: "neutral" },
  [MISSING]: { label: "Missing", tone: "neutral" },
};

export const statusLabel = (status: Status) => STATUSES[status].label;

export function StatusChip({ status }: { status: Status }) {
  return (
    <Pill dot={status !== MISSING} tone={STATUSES[status].tone}>
      {STATUSES[status].label}
    </Pill>
  );
}
