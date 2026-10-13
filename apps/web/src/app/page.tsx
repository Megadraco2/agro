import { HealthCheck } from '@/components/health-check';
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-6 px-6 py-12">
      <p className="text-sm font-semibold uppercase tracking-widest">Agro</p>
      <h1 className="text-4xl font-semibold">Gestão agrícola</h1>
      <p>Base da plataforma em preparação.</p>
      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Conexão com a API</h2>
        <HealthCheck />
      </section>
    </main>
  );
}
