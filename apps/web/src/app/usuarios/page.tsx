'use client';
import { useEffect, useState } from 'react';
import { Button } from '@agro/ui/button';
import { criarUsuario, listarUsuarios } from '@/lib/usuarios';
import type { UsuarioResponse } from '@agro/contracts';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<UsuarioResponse[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function carregarUsuarios() {
    return listarUsuarios(process.env.NEXT_PUBLIC_API_URL)
      .then((dados) => {
        setUsuarios(dados);
        setErroLista(null);
      })
      .catch((e: unknown) => {
        setErroLista(
          e instanceof Error ? e.message : 'Não foi possível listar usuários',
        );
      })
      .finally(() => {
        setCarregandoLista(false);
      });
  }

  useEffect(() => {
    carregarUsuarios();
  }, []);

  async function aoEnviar(event: React.FormEvent) {
    event.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      await criarUsuario(process.env.NEXT_PUBLIC_API_URL, { email, senha });
      setEmail('');
      setSenha('');
      await carregarUsuarios();
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : 'Não foi possível criar o usuário',
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-10 px-6 py-12">
      <h1 className="text-2xl font-semibold">Usuários</h1>
      <a
        href="/propriedades"
        className="text-sm text-muted-foreground underline"
      >
        Ir para Propriedades
      </a>

      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Usuários da organização</h2>
        {carregandoLista && <p>Carregando…</p>}
        {erroLista && (
          <p role="alert" className="text-sm text-red-600">
            {erroLista}
          </p>
        )}
        {!carregandoLista && !erroLista && (
          <ul className="space-y-2">
            {usuarios.map((usuario) => (
              <li
                key={usuario.id}
                className="flex items-center justify-between border-b border-border pb-2 text-sm"
              >
                <span>{usuario.email}</span>
                <span className="text-muted-foreground">{usuario.papel}</span>
              </li>
            ))}
            {usuarios.length === 0 && (
              <li className="text-sm text-muted-foreground">
                Nenhum usuário cadastrado.
              </li>
            )}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Novo usuário</h2>
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
            {carregando ? 'Criando…' : 'Criar usuário'}
          </Button>
        </form>
      </section>
    </main>
  );
}
