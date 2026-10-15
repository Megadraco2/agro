'use client';
import { useEffect, useState } from 'react';
import { Button } from '@agro/ui/button';
import { Modal } from '@agro/ui/modal';
import { Input, Select } from '@agro/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@agro/ui/table';
import {
  apagarProcedimento,
  criarProcedimento,
  editarProcedimento,
  listarProcedimentos,
} from '@/lib/procedimentos';
import type { ProcedimentoResponse, TipoProcedimento } from '@agro/contracts';

const OPCOES_TIPO: { value: TipoProcedimento; label: string }[] = [
  { value: 'APLICACAO', label: 'Aplicação' },
  { value: 'PLANTIO', label: 'Plantio' },
  { value: 'COLHEITA', label: 'Colheita' },
  { value: 'IRRIGACAO', label: 'Irrigação' },
  { value: 'OUTRO', label: 'Outro' },
];

type ModalState =
  | { tipo: 'criar' }
  | { tipo: 'editar'; procedimento: ProcedimentoResponse }
  | { tipo: 'apagar'; procedimento: ProcedimentoResponse }
  | null;

export default function ProcedimentosPage() {
  const [procedimentos, setProcedimentos] = useState<ProcedimentoResponse[]>(
    [],
  );
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoProcedimento>('APLICACAO');
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregarProcedimentos() {
    return listarProcedimentos(process.env.NEXT_PUBLIC_API_URL)
      .then((dados) => {
        setProcedimentos(dados);
        setErroLista(null);
      })
      .catch((e: unknown) => {
        setErroLista(
          e instanceof Error
            ? e.message
            : 'Não foi possível listar procedimentos',
        );
      })
      .finally(() => {
        setCarregandoLista(false);
      });
  }

  useEffect(() => {
    carregarProcedimentos();
  }, []);

  function abrirCriar() {
    setNome('');
    setTipo('APLICACAO');
    setErroForm(null);
    setModal({ tipo: 'criar' });
  }

  function abrirEditar(procedimento: ProcedimentoResponse) {
    setNome(procedimento.nome);
    setTipo(procedimento.tipo);
    setErroForm(null);
    setModal({ tipo: 'editar', procedimento });
  }

  function abrirApagar(procedimento: ProcedimentoResponse) {
    setErroForm(null);
    setModal({ tipo: 'apagar', procedimento });
  }

  function fecharModal() {
    setModal(null);
  }

  async function aoSalvar(event: React.FormEvent) {
    event.preventDefault();
    if (!modal || modal.tipo === 'apagar') return;
    setSalvando(true);
    setErroForm(null);
    try {
      const dados = { nome, tipo };
      if (modal.tipo === 'criar') {
        await criarProcedimento(process.env.NEXT_PUBLIC_API_URL, dados);
      } else {
        await editarProcedimento(
          process.env.NEXT_PUBLIC_API_URL,
          modal.procedimento.id,
          dados,
        );
      }
      fecharModal();
      await carregarProcedimentos();
    } catch (e) {
      setErroForm(
        e instanceof Error
          ? e.message
          : 'Não foi possível salvar o procedimento',
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
      await apagarProcedimento(
        process.env.NEXT_PUBLIC_API_URL,
        modal.procedimento.id,
      );
      fecharModal();
      await carregarProcedimentos();
    } catch (e) {
      setErroForm(
        e instanceof Error
          ? e.message
          : 'Não foi possível apagar o procedimento',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Procedimentos</h1>
        <Button onClick={abrirCriar}>Novo procedimento</Button>
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
              <TableHead>Tipo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {procedimentos.map((procedimento) => (
              <TableRow key={procedimento.id}>
                <TableCell>{procedimento.nome}</TableCell>
                <TableCell>
                  {OPCOES_TIPO.find((o) => o.value === procedimento.tipo)
                    ?.label ?? procedimento.tipo}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirEditar(procedimento)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirApagar(procedimento)}
                    >
                      Apagar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {procedimentos.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-sm text-muted-foreground"
                  colSpan={3}
                >
                  Nenhum procedimento cadastrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Modal
        open={modal !== null && modal.tipo !== 'apagar'}
        onOpenChange={(open) => !open && fecharModal()}
        title={
          modal?.tipo === 'editar' ? 'Editar procedimento' : 'Novo procedimento'
        }
      >
        <form onSubmit={aoSalvar} className="space-y-4">
          <Input
            label="Nome"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Select
            label="Tipo"
            required
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoProcedimento)}
            options={OPCOES_TIPO}
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
        title="Apagar procedimento"
      >
        {modal?.tipo === 'apagar' && (
          <div className="space-y-4">
            <p className="text-sm">
              Tem certeza que quer apagar{' '}
              <strong>{modal.procedimento.nome}</strong>? Essa ação não pode ser
              desfeita.
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
