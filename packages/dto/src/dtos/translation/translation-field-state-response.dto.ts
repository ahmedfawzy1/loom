import { Expose } from "class-transformer";

export const FIELD_SYNC_STATES = [
  "changed",
  "edited",
  "untracked",
  "copied",
] as const;
export type FieldSyncState = (typeof FIELD_SYNC_STATES)[number];

/**
 * One field of a translation that no longer matches its source: `changed` still holds what the
 * machine wrote (or is blank), so a translate updates it; `edited` was written or changed by a
 * person, so a translate keeps it unless told to replace it; `untracked` has no record of its
 * source; `copied` is carried over from the source as it is, never translated.
 */
export class TranslationFieldStateResponseDto {
  @Expose()
  name: string;

  @Expose()
  state: FieldSyncState;
}
