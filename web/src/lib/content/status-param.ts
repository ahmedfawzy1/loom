import { LocaleStatus } from "@loom/dto/models";

/** A `?status=` a link opened the list with, if it names a real status. */
export const parseStatusParam = (value: string | string[] | undefined) =>
  Object.values(LocaleStatus).find((status) => status === value);
