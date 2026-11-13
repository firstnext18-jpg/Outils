"use client";

import { PaperclipIcon } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { FILES_PER_UPLOAD } from "@/domain/files";

/** Bouton qui ouvre le sélecteur de fichiers du système (plusieurs fichiers possibles). */
export function FilePicker({
  label,
  onPick,
  disabled,
  variant = "outline",
  size = "sm",
  iconOnly = false,
}: {
  label: string;
  onPick: (files: File[]) => void;
  disabled?: boolean;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default" | "icon";
  iconOnly?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        aria-label={label}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []).slice(0, FILES_PER_UPLOAD);
          event.target.value = "";
          if (files.length) onPick(files);
        }}
      />
      <Button
        type="button"
        variant={variant}
        size={iconOnly ? "icon" : size}
        disabled={disabled}
        onClick={() => input.current?.click()}
        aria-label={iconOnly ? label : undefined}
      >
        <PaperclipIcon />
        {!iconOnly && label}
      </Button>
    </>
  );
}
