"use client";

import { Button, type ButtonProps, toast } from "@heroui/react";
import type { MediaResponseDto } from "@loom/dto";
import { MEDIA_ALLOWED_MIME_TYPES } from "@loom/dto/constants";
import { useUploadMedia } from "@loom-web/src/hooks/media/useMedia";
import { UploadSimple } from "@phosphor-icons/react";
import { useRef } from "react";

export function MediaUploadButton({
  onUploaded,
  label = "Upload image",
  variant = "secondary",
}: {
  onUploaded?: (media: Serialized<MediaResponseDto>) => void;
  label?: string;
  variant?: ButtonProps["variant"];
}) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadMedia();

  return (
    <>
      <input
        accept={MEDIA_ALLOWED_MIME_TYPES.join(",")}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so choosing the same file again after a failure still fires onChange
          event.target.value = "";
          if (file)
            upload.mutate(
              { file },
              {
                onSuccess: (uploaded) => {
                  toast.success(`Uploaded ${uploaded.filename}`);
                  onUploaded?.(uploaded);
                },
                onError: (error) => toast.danger(error.message),
              },
            );
        }}
        ref={input}
        type="file"
      />
      <Button
        isDisabled={upload.isPending}
        onPress={() => input.current?.click()}
        variant={variant}
      >
        <UploadSimple className="size-4" />
        {upload.isPending ? "Uploading…" : label}
      </Button>
    </>
  );
}
