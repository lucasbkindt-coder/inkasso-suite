"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type PartyDetail } from "./party-api";
import { PartyForm } from "./party-form";
export function PartyDialog({
  open,
  onOpenChange,
  party,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  party?: PartyDetail;
  onSaved: (party: PartyDetail) => void;
}) {
  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border bg-card p-6 shadow-xl">
          <div className="mb-5 flex justify-between">
            <div>
              <Dialog.Title className="text-lg font-semibold">
                {party ? "Partei bearbeiten" : "Neue Partei"}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">
                Stammdaten im Arbeitsbereich pflegen.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <PartyForm
            onSaved={(result) => {
              onOpenChange(false);
              onSaved(result);
            }}
            party={party}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
