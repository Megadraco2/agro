import Link from 'next/link';
import { Pill } from '@agro/ui/pill';

const AREAS_ATIVAS = [
  { href: '/propriedades', label: 'Propriedades' },
  { href: '/procedimentos', label: 'Procedimentos' },
  { href: '/insumos', label: 'Insumos' },
];

const AREAS_FUTURAS = [
  'Talhões',
  'Safras',
  'Planejamento',
  'Execução',
  'Compra de Insumo',
];

export default function DominioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <aside className="flex w-60 flex-col gap-1 border-r border-border bg-white px-4 py-6">
        <span className="mb-6 px-2 text-lg font-semibold tracking-wide text-primary">
          AGRO
        </span>
        <nav className="flex flex-col gap-1">
          {AREAS_ATIVAS.map((area) => (
            <Link
              key={area.href}
              href={area.href}
              className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-background"
            >
              {area.label}
            </Link>
          ))}
          {AREAS_FUTURAS.map((label) => (
            <span
              key={label}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-muted-foreground"
            >
              {label}
              <Pill variant="muted">Em breve</Pill>
            </span>
          ))}
        </nav>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
