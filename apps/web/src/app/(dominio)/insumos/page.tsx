'use client';
import { useEffect, useState } from 'react';
import { Button } from '@agro/ui/button';
import { Modal } from '@agro/ui/modal';
import { Input } from '@agro/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@agro/ui/table';
import {
  apagarInsumo,
  criarInsumo,
  editarPrecoInsumo,
  listarInsumos,
} from '@/lib/insumos';
import type { InsumoResponse } from '@agro/contracts';

type ModalState =
  | { tipo: 'criar' }
  | { tipo: 'editar'; insumo: InsumoResponse }
  | { tipo: 'apagar'; insumo: InsumoResponse }
  | null;

export default function InsumosPage() {
  const [insumos, setInsumos] = useState<InsumoResponse[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [nome, setNome] = useState('');
  const [unidade, setUnidade] = useState('');
  const [precoUnitarioAtual, setPrecoUnitarioAtual] = useState('');
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregarInsumos() {
    return listarInsumos(process.env.NEXT_PUBLIC_API_URL)
      .then((dados) => {
        setInsumos(dados);
        setErroLista(null);
      })
      .catch((e: unknown) => {
        setErroLista(
          e instanceof Error ? e.message : 'Não foi possível listar insumos',
        );
      })
      .finally(() => {
        setCarregandoLista(false);
      });
  }

  useEffect(() => {
    carregarInsumos();
  }, []);

  function abrirCriar() {
    setNome('');
    setUnidade('');
    setPrecoUnitarioAtual('');
    setErroForm(null);
    setModal({ tipo: 'criar' });
  }

  function abrirEditar(insumo: InsumoResponse) {
    setPrecoUnitarioAtual(insumo.precoUnitarioAtual);
    setErroForm(null);
    setModal({ tipo: 'editar', insumo });
  }

  function abrirApagar(insumo: InsumoResponse) {
    setErroForm(null);
    setModal({ tipo: 'apagar', insumo });
  }

  function fecharModal() {
    setModal(null);
  }

  async function aoCriar(event: React.FormEvent) {
    event.preventDefault();
    setSalvando(true);
    setErroForm(null);
    try {
      await criarInsumo(process.env.NEXT_PUBLIC_API_URL, {
        nome,
        unidade,
        precoUnitarioAtual: Number(precoUnitarioAtual),
      });
      fecharModal();
      await carregarInsumos();
    } catch (e) {
      setErroForm(
        e instanceof Error ? e.message : 'Não foi possível criar o insumo',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function aoEditarPreco(event: React.FormEvent) {
    event.preventDefault();
    if (!modal || modal.tipo !== 'editar') return;
    setSalvando(true);
    setErroForm(null);
    try {
      await editarPrecoInsumo(
        process.env.NEXT_PUBLIC_API_URL,
        modal.insumo.id,
        {
          precoUnitarioAtual: Number(precoUnitarioAtual),
        },
      );
      fecharModal();
      await carregarInsumos();
    } catch (e) {
      setErroForm(
        e instanceof Error ? e.message : 'Não foi possível editar o preço',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function aoConfirmarExclusao() {
    if (!modal || modal.tipo !== 'apagar') return;
    setSalvando(true);
    setErroForm(null);
    try {
      await apagarInsumo(process.env.NEXT_PUBLIC_API_URL, modal.insumo.id);
      fecharModal();
      await carregarInsumos();
    } catch (e) {
      setErroForm(
        e instanceof Error ? e.message : 'Não foi possível apagar o insumo',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Insumos</h1>
        <Button onClick={abrirCriar}>Novo insumo</Button>
      </div>

      {carregandoLista && <p>Carregando…</p>}
      {erroLista && (
        <p role="alert" className="text-sm text-red-600">
          {erroLista}
        </p>
      )}

      {!carregandoLista && !erroLista && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Preço unitário</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {insumos.map((insumo) => (
              <TableRow key={insumo.id}>
                <TableCell>{insumo.nome}</TableCell>
                <TableCell>{insumo.unidade}</TableCell>
                <TableCell numeric>{insumo.precoUnitarioAtual}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirEditar(insumo)}
                    >
                      Editar preço
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirApagar(insumo)}
                    >
                      Apagar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {insumos.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-sm text-muted-foreground"
                  colSpan={4}
                >
                  Nenhum insumo cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Modal
        open={modal?.tipo === 'criar'}
        onOpenChange={(open) => !open && fecharModal()}
        title="Novo insumo"
      >
        <form onSubmit={aoCriar} className="space-y-4">
          <Input
            label="Nome"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Input
            label="Unidade"
            required
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
          />
          <Input
            label="Preço unitário"
            type="number"
            min={0}
            step="0.0001"
            required
            value={precoUnitarioAtual}
            onChange={(e) => setPrecoUnitarioAtual(e.target.value)}
          />
          {erroForm && (
            <p role="alert" className="text-sm text-red-600">
              {erroForm}
            </p>
          )}
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={modal?.tipo === 'editar'}
        onOpenChange={(open) => !open && fecharModal()}
        title="Editar preço"
      >
        <form onSubmit={aoEditarPreco} className="space-y-4">
          <Input
            label="Preço unitário"
            type="number"
            min={0}
            step="0.0001"
            required
            value={precoUnitarioAtual}
            onChange={(e) => setPrecoUnitarioAtual(e.target.value)}
          />
          {erroForm && (
            <p role="alert" className="text-sm text-red-600">
              {erroForm}
            </p>
          )}
          <Button type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </Modal>

      <Modal
        open={modal?.tipo === 'apagar'}
        onOpenChange={(open) => !open && fecharModal()}
        title="Apagar insumo"
      >
        {modal?.tipo === 'apagar' && (
          <div className="space-y-4">
            <p className="text-sm">
              Tem certeza que quer apagar <strong>{modal.insumo.nome}</strong>?
              Essa ação não pode ser desfeita.
            </p>
            {erroForm && (
              <p role="alert" className="text-sm text-red-600">
                {erroForm}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={fecharModal}>
                Cancelar
              </Button>
              <Button onClick={aoConfirmarExclusao} disabled={salvando}>
                {salvando ? 'Apagando…' : 'Apagar'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}
