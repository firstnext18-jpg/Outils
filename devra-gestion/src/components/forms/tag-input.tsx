"use client";

import { XIcon } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { normalizeTags, TAG_MAX_LENGTH, TAGS_MAX_COUNT } from "@/domain/clients";

/**
 * Saisie d'étiquettes : Entrée ou virgule pour ajouter, × pour retirer.
 * Les étiquettes déjà utilisées sont proposées en suggestion.
 */
export function TagInput({
  value,
  onChange,
  suggestions,
  id,
  ...props
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const listId = useId();

  function add(raw: string) {
    const next = normalizeTags([...value, ...raw.split(",")]);
    onChange(next);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1 font-normal">
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="hover:bg-muted-foreground/20 rounded-sm p-0.5"
                aria-label={`Retirer le tag ${tag}`}
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        id={id}
        list={listId}
        value={draft}
        maxLength={TAG_MAX_LENGTH}
        disabled={value.length >= TAGS_MAX_COUNT}
        placeholder="Ajouter un tag puis Entrée"
        onChange={(event) => {
          const text = event.target.value;
          if (text.endsWith(",")) add(text);
          else setDraft(text);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            if (draft.trim()) add(draft);
          } else if (event.key === "Backspace" && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        {...props}
      />
      <datalist id={listId}>
        {suggestions
          .filter((s) => !value.some((t) => t.toLowerCase() === s.toLowerCase()))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}
