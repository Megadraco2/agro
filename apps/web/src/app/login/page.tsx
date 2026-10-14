'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@agro/ui/button';
import { login } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function aoEnviar(event: React.FormEvent) {
    event.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      await login(process.env.NEXT_PUBLIC_API_URL, { email, senha });
      router.push('/usuarios');
    } catch {
      setErro('Email ou senha inválidos.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <form onSubmit={aoEnviar} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Senha</span>
          <input
            type="password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            className="w-full rounded-lg border border-border px-3 py-2"
          />
        </label>
        {erro && (
          <p role="alert" className="text-sm text-red-600">
            {erro}
          </p>
        )}
        <Button type="submit" disabled={carregando}>
          {carregando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <a href="/admin/login" className="text-sm text-muted-foreground">
        Acesso administrativo
      </a>
    </main>
  );
}
