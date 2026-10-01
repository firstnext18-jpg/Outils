"use client";

import { useState } from "react";
import {
  useDocumentForm,
  type DocumentEditorSettings,
} from "@/components/documents/editor/form-context";
import type { PickerClient } from "@/modules/clients/service";

/**
 * Choix du client et de la langue : la langue suit celle du client, et les
 * textes encore « par défaut » passent dans la nouvelle langue.
 */
export function useClientAndLanguage(
  settings: DocumentEditorSettings,
  initialClient: PickerClient | null,
) {
  const form = useDocumentForm();
  const { getValues, setValue } = form;
  const [client, setClient] = useState<PickerClient | null>(initialClient);

  function changeLanguage(next: "FR" | "DE") {
    const previous = getValues("language");
    if (previous === next) return;
    setValue("language", next, { shouldDirty: true });
    const from = settings.texts[previous];
    const to = settings.texts[next];
    const intro = getValues("introText");
    if (!intro.trim() || intro === from.intro) setValue("introText", to.intro);
    const conditions = getValues("conditionsText");
    if (!conditions.trim() || conditions === from.conditions) {
      setValue("conditionsText", to.conditions);
    }
  }

  function pickClient(picked: PickerClient) {
    setClient(picked);
    setValue("clientId", picked.id, { shouldValidate: form.formState.isSubmitted });
    changeLanguage(picked.language);
    if (!getValues("siteTypeId") && picked.siteTypeId) setValue("siteTypeId", picked.siteTypeId);
  }

  return { client, pickClient, changeLanguage };
}
