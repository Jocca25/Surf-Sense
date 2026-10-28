"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, GitCompare, House, SlidersHorizontal } from "lucide-react";
import { useApp } from "@/components/app-provider";

const NAV = [
  { href: "/", label: "Hoje", icon: House },
  { href: "/praias", label: "Praias", icon: Compass },
  { href: "/favoritos", label: "Favoritas", icon: Compass },
  { href: "/comparar", label: "Comparar", icon: GitCompare },
  { href: "/alertas", label: "Alertas", icon: Bell },
  { href: "/preferencias", label: "Preferências", icon: SlidersHorizontal },
];

const MOBILE = [
  { href: "/", label: "Hoje", icon: House },
  { href: "/praias", label: "Praias", icon: Compass },
  { href: "/comparar", label: "Comparar", icon: GitCompare },
  { href: "/alertas", label: "Alertas", icon: Bell },
  { href: "/preferencias", label: "Eu", icon: SlidersHorizontal },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { inbox } = useApp();
  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-navy focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Saltar para o conteúdo
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-navy text-primary-foreground lg:flex">
        <div className="px-6 pt-8 pb-6">
          <p className="text-xs tracking-[0.22em] text-white/60 uppercase">Costa de Lisboa</p>
          <Link href="/" className="font-serif mt-2 block text-3xl">
            Barlavento
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
                {item.href === "/alertas" && inbox.length > 0 ? (
                  <span className="ml-auto rounded-full bg-sand px-2 py-0.5 text-xs text-navy">{inbox.length}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <p className="px-6 pb-6 text-xs leading-relaxed text-white/55">
          A pontuação descreve a onda prevista. Não é uma garantia de segurança.
        </p>
      </aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border/80 bg-background/85 px-4 py-3 backdrop-blur lg:hidden">
          <Link href="/" className="font-serif text-2xl text-navy">
            Barlavento
          </Link>
          <Link href="/alertas" className="relative rounded-full p-2 text-navy" aria-label="Alertas">
            <Bell className="size-5" />
            {inbox.length > 0 ? (
              <span className="absolute top-1 right-1 size-2 rounded-full bg-poor" />
            ) : null}
          </Link>
        </header>
        <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 py-5 pb-28 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-paper/95 backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
          {MOBILE.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={`flex flex-col items-center gap-1 py-2 text-[11px] ${active ? "text-navy" : "text-muted-foreground"}`}
                >
                  <Icon className="size-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
