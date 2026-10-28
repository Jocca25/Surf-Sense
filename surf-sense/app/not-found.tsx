import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-3xl bg-paper px-6 py-10 ring-1 ring-foreground/10">
      <h1 className="font-serif text-3xl text-navy">Esta praia não está na carta</h1>
      <p className="mt-2 text-sm text-muted-foreground">A lista começa na costa de Lisboa.</p>
      <Link href="/praias" className="mt-4 inline-block text-sm text-ocean">
        Ver as praias
      </Link>
    </div>
  );
}
