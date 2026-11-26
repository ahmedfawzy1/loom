import type { ListMediaRequestDto, UpdateMediaRequestDto } from "@loom/dto";
import {
  MEDIA_ALLOWED_MIME_TYPES,
  MEDIA_MAX_UPLOAD_BYTES,
} from "@loom/dto/constants";
import type { Media } from "@loom/dto/models";
import { ApiError, media } from "@loom-web/src/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const mediaKeys = {
  all: ["media"] as const,
  lists: () => [...mediaKeys.all, "list"] as const,
  list: (query: ListMediaRequestDto) => [...mediaKeys.lists(), query] as const,
  detail: (mediaId: Media["id"]) =>
    [...mediaKeys.all, "detail", mediaId] as const,
  usages: (mediaId: Media["id"]) =>
    [...mediaKeys.all, "usages", mediaId] as const,
};

export const useMediaList = (query: ListMediaRequestDto) =>
  useQuery({
    queryKey: mediaKeys.list(query),
    queryFn: () => media.list(query),
  });

export const useMediaItem = (mediaId: Media["id"] | null | undefined) =>
  useQuery({
    queryKey: mediaKeys.detail(mediaId ?? ""),
    queryFn: () => media.get(mediaId as Media["id"]),
    enabled: Boolean(mediaId),
  });

export const useMediaUsages = (mediaId: Media["id"] | undefined) =>
  useQuery({
    queryKey: mediaKeys.usages(mediaId ?? ""),
    queryFn: () => media.usages(mediaId as Media["id"]),
    enabled: Boolean(mediaId),
  });

/**
 * Checked before asking for an upload URL, so an obvious mistake fails instantly rather than after
 * the file has crossed the network. The API re-checks everything against the stored bytes — this
 * is for speed, not safety.
 */
function assertUploadable(file: File) {
  if (!(MEDIA_ALLOWED_MIME_TYPES as readonly string[]).includes(file.type))
    throw new ApiError(
      `${file.type || "That file type"} is not supported — use JPEG, PNG, WebP, GIF or AVIF`,
    );
  if (file.size > MEDIA_MAX_UPLOAD_BYTES)
    throw new ApiError(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MEDIA_MAX_UPLOAD_BYTES / 1024 / 1024} MB`,
    );
}

/** Ask for a signed policy, POST the file straight to storage, then let the API measure it. */
async function uploadFile(file: File) {
  assertUploadable(file);
  const upload = await media.createUpload({
    filename: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
  });
  await media.postFile(upload, file);
  return upload.key;
}

export const useUploadMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      altText,
    }: {
      file: File;
      altText?: Media["altText"];
    }) => {
      const key = await uploadFile(file);
      return media.confirm({ key, filename: file.name, altText });
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: mediaKeys.lists() }),
  });
};

export const useReplaceMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      mediaId,
      file,
    }: {
      mediaId: Media["id"];
      file: File;
    }) => media.replace(mediaId, await uploadFile(file)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mediaKeys.all }),
  });
};

export const useUpdateMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      mediaId,
      args,
    }: {
      mediaId: Media["id"];
      args: UpdateMediaRequestDto;
    }) => media.update(mediaId, args),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: mediaKeys.lists() }),
  });
};

export const useDeleteMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mediaId: Media["id"]) => media.remove(mediaId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mediaKeys.all }),
  });
};

export const useRestoreMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mediaId: Media["id"]) => media.restore(mediaId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mediaKeys.all }),
  });
};
