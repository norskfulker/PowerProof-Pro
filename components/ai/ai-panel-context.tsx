"use client";

import { createContext, useContext } from "react";
import type { AiAspect, AiPurpose, MediaItem } from "@/lib/types";

export interface AiPanelRequest {
  purpose: AiPurpose;
  aspect?: AiAspect;
  /** Called with the saved library item when the creator picks "Use this image" */
  onUse: (item: MediaItem) => void;
}

/** Opens the AI image maker as a side panel from any image field. Provided by AiPanelProvider. */
export const AiPanelContext = createContext<{ open: (req: AiPanelRequest) => void } | null>(null);

export function useAiPanel() {
  return useContext(AiPanelContext);
}
