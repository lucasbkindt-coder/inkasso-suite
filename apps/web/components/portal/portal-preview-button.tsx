"use client";
import { ExternalLink, Loader2 } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
export function PortalPreviewButton({
  kind,
  id,
  label,
}: {
  kind: "client" | "debtor" | "debtor-case";
  id: string;
  label: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const open = async () => {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      setError("Der Browser hat das Öffnen eines neuen Tabs blockiert.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/portal-preview/${kind}/${id}`, { method: "POST" });
      if (!response.ok) throw new Error("Portalvorschau konnte nicht geöffnet werden.");
      const data = (await response.json()) as { previewUrl: string };
      previewWindow.location.replace(new URL(data.previewUrl, window.location.origin).toString());
    } catch (cause) {
      previewWindow.close();
      setError(
        cause instanceof Error ? cause.message : "Portalvorschau konnte nicht geöffnet werden.",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div>
      <Button disabled={loading} onClick={() => void open()} variant="outline">
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ExternalLink className="size-4" />
        )}
        {label}
      </Button>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
