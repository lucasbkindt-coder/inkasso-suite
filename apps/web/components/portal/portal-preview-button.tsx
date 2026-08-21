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
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/portal-preview/${kind}/${id}`, { method: "POST" });
      if (!response.ok) throw new Error("Portalvorschau konnte nicht geöffnet werden.");
      const data = (await response.json()) as { previewUrl: string };
      window.open(data.previewUrl, "_blank", "noopener,noreferrer");
    } catch (cause) {
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
