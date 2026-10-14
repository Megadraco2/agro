'use client';
import { useEffect, useState } from 'react';
import { Button } from '@agro/ui/button';
import { criarOrganizacao, listarOrganizacoes } from '@/lib/organizacoes';
import type { OrganizacaoAdminResponse } from '@agro/contracts';

export default function OrganizacoesPage() {
  const [organizacoes, setOrganizacoes] = useState<OrganizacaoAdminResponse[]>(
    [],
  );
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [maxUsuarios, setMaxUsuarios] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminSenha, setAdminSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  function carregarOrganizacoes() {
    return listarOrganizacoes(process.env.NEXT_PUBLIC_API_URL)
      .then((dados) => {
        setOrganizacoes(dados);
        setErroLista(null);
      })
      .catch((e: unknown) => {
        setErroLista(
          e instanceof Error
            ? e.message
            : 'Não foi possível listar organizações',
        );
      })
      .finally(() => {
        setCarregandoLista(false);
      });
  }

  useEffect(() => {
    carregarOrganizacoes();
  }, []);

  async function aoEnviar(event: React.FormEvent) {
    event.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      await criarOrganizacao(process.env.NEXT_PUBLIC_API_URL, {
        nome,
        maxUsuarios: Number(maxUsuarios),
        adminEmail,
        adminSenha,
      });
      setNome('');
      setMaxUsuarios('');
      setAdminEmail('');
      setAdminSenha('');
      await carregarOrganizacoes();
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : 'Não foi possível criar a organização',
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-10 px-6 py-12">
      <h1 className="text-2xl font-semibold">Organizações</h1>

      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Organizações cadastradas</h2>
        {carregandoLista && <p>Carregando…</p>}
        {erroLista && (
          <p role="alert" className="text-sm text-red-600">
            {erroLista}
          </p>
        )}
        {!carregandoLista && !erroLista && (
          <ul className="space-y-2">
            {organizacoes.map((organizacao) => (
              <li
                key={organizacao.id}
                className="flex items-center justify-between border-b border-border pb-2 text-sm"
              >
                <span>{organizacao.nome}</span>
                <span className="text-muted-foreground">
                  {organizacao.totalUsuarios}/{organizacao.maxUsuarios} vagas
                </span>
              </li>
            ))}
            {organizacoes.length === 0 && (
              <li className="text-sm text-muted-foreground">
                Nenhuma organização cadastrada.
              </li>
            )}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold">Nova organização</h2>
        <form onSubmit={aoEnviar} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Nome</span>
            <input
              type="text"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Máximo de usuários</span>
            <input
              type="number"
              min={1}
              required
              value={maxUsuarios}
              onChange={(e) => setMaxUsuarios(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Email do administrador</span>
            <input
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Senha do administrador</span>
            <input
              type="password"
              required
              value={adminSenha}
              onChange={(e) => setAdminSenha(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2"
            />
          </label>
          {erro && (
            <p role="alert" className="text-sm text-red-600">
              {erro}
            </p>
          )}
          <Button type="submit" disabled={carregando}>
            {carregando ? 'Criando…' : 'Criar organização'}
          </Button>
        </form>
      </section>
    </main>
  );
}
