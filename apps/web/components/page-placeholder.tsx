import { Construction } from "lucide-react";

export function PagePlaceholder({ description, title }: { description: string; title: string }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Arbeitsbereich</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="grid min-h-80 place-items-center rounded-xl border border-dashed border-border bg-card p-8 shadow-sm">
        <div className="max-w-sm text-center">
          <div className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
            <Construction className="size-5" />
          </div>
          <h3 className="mt-4 font-medium">Bereich wird vorbereitet</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Die Oberfläche und Navigation stehen bereits. Inhalte folgen in einem späteren
            Ausbauschritt.
          </p>
        </div>
      </div>
    </section>
  );
}
