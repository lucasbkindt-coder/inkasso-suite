import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function PageHero({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <section className="border-b border-slate-200 bg-[#f5f9fc]"><div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20 lg:py-24"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#006da9]">{eyebrow}</p><h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-slate-950 sm:text-5xl lg:text-[3.5rem]">{title}</h1><p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">{description}</p>{children ? <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div> : null}</div></section>;
}

export function SectionIntro({ eyebrow, title, description }: { eyebrow?: string; title: string; description: string }) {
  return <div className="max-w-3xl">{eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#006da9]">{eyebrow}</p> : null}<h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.025em] text-slate-950 sm:text-4xl">{title}</h2><p className="mt-5 max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">{description}</p></div>;
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#007FC5] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#006da9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007FC5]" href={href}>{children}<ArrowRight className="size-4" /></Link>;
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:border-[#007FC5] hover:text-[#006da9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007FC5]" href={href}>{children}<ArrowRight className="size-4" /></Link>;
}

export function CheckList({ items }: { items: string[] }) {
  return <ul className="space-y-3">{items.map((item)=><li className="flex gap-3 text-sm leading-6 text-slate-700" key={item}><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#e5f4fb] text-[#007FC5]"><Check className="size-3.5" /></span>{item}</li>)}</ul>;
}

export function CtaSection({ title, description, primary, secondary }: { title: string; description: string; primary: [string,string]; secondary?: [string,string] }) {
  return <section className="bg-[#007FC5]"><div className="mx-auto flex max-w-7xl flex-col gap-7 px-5 py-14 text-white sm:px-8 lg:flex-row lg:items-center lg:justify-between"><div className="max-w-2xl"><h2 className="text-3xl font-semibold tracking-[-0.025em]">{title}</h2><p className="mt-3 leading-7 text-white/90">{description}</p></div><div className="flex shrink-0 flex-col gap-3 sm:flex-row"><Link className="rounded-xl bg-white px-6 py-3 text-center text-sm font-semibold text-[#006da9]" href={primary[1]}>{primary[0]}</Link>{secondary?<Link className="rounded-xl border border-white/50 px-6 py-3 text-center text-sm font-semibold text-white" href={secondary[1]}>{secondary[0]}</Link>:null}</div></div></section>;
}
