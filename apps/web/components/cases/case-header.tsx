"use client";

import {
    ArrowLeft,
    Building2,
    CircleDollarSign,
    User
} from "lucide-react";

import Link from "next/link";

export function CaseHeader() {

    return (

        <section className="rounded-2xl border bg-card p-8 shadow-lg">

            <div className="flex items-center justify-between">

                <div>

                    <Link
                        href="/akten"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Zur Aktenübersicht
                    </Link>

                    <h1 className="mt-5 text-4xl font-bold tracking-tight">
                        AKT-2026-000001
                    </h1>

                    <p className="mt-2 text-lg text-muted-foreground">
                        Max Mustermann
                    </p>

                </div>

                <span className="rounded-full bg-blue-100 px-4 py-2 font-semibold text-blue-700">
                    Außergerichtlich
                </span>

            </div>

            <div className="mt-8 grid gap-4 lg:grid-cols-4">

                <div className="rounded-xl bg-muted/40 p-5">

                    <CircleDollarSign className="mb-3 h-5 w-5 text-primary" />

                    <p className="text-sm text-muted-foreground">
                        Offene Forderung
                    </p>

                    <h3 className="mt-2 text-2xl font-bold">
                        4.825,60 €
                    </h3>

                </div>

                <div className="rounded-xl bg-muted/40 p-5">

                    <Building2 className="mb-3 h-5 w-5 text-primary" />

                    <p className="text-sm text-muted-foreground">
                        Auftraggeber
                    </p>

                    <h3 className="mt-2 font-semibold">
                        RisePay GmbH
                    </h3>

                </div>

                <div className="rounded-xl bg-muted/40 p-5">

                    <User className="mb-3 h-5 w-5 text-primary" />

                    <p className="text-sm text-muted-foreground">
                        Sachbearbeiter
                    </p>

                    <h3 className="mt-2 font-semibold">
                        Lucas Kindt
                    </h3>

                </div>

                <div className="rounded-xl bg-muted/40 p-5">

                    <p className="text-sm text-muted-foreground">
                        Letzte Aktivität
                    </p>

                    <h3 className="mt-2 font-semibold">
                        vor 2 Stunden
                    </h3>

                </div>

            </div>

        </section>

    );

}