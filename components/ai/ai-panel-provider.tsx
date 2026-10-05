"use client";

import { useCallback, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { AiImageMaker } from "./ai-image-maker";
import { AiPanelContext, type AiPanelRequest } from "./ai-panel-context";

/** Lets any image field open the AI image maker as a side panel and get the chosen image back. */
export function AiPanelProvider({ children }: { children: React.ReactNode }) {
  const [req, setReq] = useState<AiPanelRequest | null>(null);
  const open = useCallback((r: AiPanelRequest) => setReq(r), []);
  return (
    <AiPanelContext.Provider value={{ open }}>
      {children}
      <Sheet open={!!req} onOpenChange={(o) => !o && setReq(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto p-5 sm:max-w-2xl">
          <SheetTitle className="font-display text-xl">Create with AI</SheetTitle>
          <SheetDescription>Describe it, pick a style, and choose one of four. The image goes straight into the field you came from.</SheetDescription>
          {req && (
            <div className="mt-4">
              <AiImageMaker
                compact
                initialPurpose={req.purpose}
                onUse={(item) => {
                  req.onUse(item);
                  setReq(null);
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AiPanelContext.Provider>
  );
}
