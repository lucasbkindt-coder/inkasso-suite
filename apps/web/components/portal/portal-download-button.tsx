"use client";
import * as React from "react";
export function PortalDownloadButton({ id, token }: { id: string; token?: string }) {
  const [error, setError] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const download = async () => {
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/documents/${id}/download`, {
        credentials: "include",
        headers: token ? { "x-risepay-portal-preview": token } : undefined,
      });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "dokument.pdf";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Dokument konnte nicht heruntergeladen werden.");
    } finally {
      setPending(false);
    }
  };
  return (
    <span>
      <button
        className="ml-3 text-sm font-medium text-primary hover:underline"
        disabled={pending}
        onClick={() => void download()}
        type="button"
      >
        {pending ? "Wird heruntergeladen …" : "Herunterladen"}
      </button>
      {error ? <span className="ml-2 text-xs text-destructive">{error}</span> : null}
    </span>
  );
}
