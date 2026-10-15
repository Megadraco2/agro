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
  apagarPropriedade,
  criarPropriedade,
  editarPropriedade,
  listarPropriedades,
} from '@/lib/propriedades';
import type { PropriedadeResponse } from '@agro/contracts';

type ModalState =
  | { tipo: 'criar' }
  | { tipo: 'editar'; propriedade: PropriedadeResponse }
  | { tipo: 'apagar'; propriedade: PropriedadeResponse }
  | null;

export default function PropriedadesPage() {
  const [propriedades, setPropriedades] = useState<PropriedadeResponse[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [erroLista, setErroLista] = useState<string | null>(null);

  const [modal, setModal] = useState<ModalState>(null);
  const [nome, setNome] = useState('');
  const [areaHa, setAreaHa] = useState('');
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregarPropriedades() {
    return listarPropriedades(process.env.NEXT_PUBLIC_API_URL)
      .then((dados) => {
        setPropriedades(dados);
        setErroLista(null);
      })
      .catch((e: unknown) => {
        setErroLista(
          e instanceof Error
            ? e.message
            : 'Não foi possível listar propriedades',
        );
      })
      .finally(() => {
        setCarregandoLista(false);
      });
  }

  useEffect(() => {
    carregarPropriedades();
  }, []);

  function abrirCriar() {
    setNome('');
    setAreaHa('');
    setErroForm(null);
    setModal({ tipo: 'criar' });
  }

  function abrirEditar(propriedade: PropriedadeResponse) {
    setNome(propriedade.nome);
    setAreaHa(propriedade.areaHa);
    setErroForm(null);
    setModal({ tipo: 'editar', propriedade });
  }

  function abrirApagar(propriedade: PropriedadeResponse) {
    setErroForm(null);
    setModal({ tipo: 'apagar', propriedade });
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
      const dados = { nome, areaHa: Number(areaHa) };
      if (modal.tipo === 'criar') {
        await criarPropriedade(process.env.NEXT_PUBLIC_API_URL, dados);
      } else {
        await editarPropriedade(
          process.env.NEXT_PUBLIC_API_URL,
          modal.propriedade.id,
          dados,
        );
      }
      fecharModal();
      await carregarPropriedades();
    } catch (e) {
      setErroForm(
        e instanceof Error
          ? e.message
          : 'Não foi possível salvar a propriedade',
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
      await apagarPropriedade(
        process.env.NEXT_PUBLIC_API_URL,
        modal.propriedade.id,
      );
      fecharModal();
      await carregarPropriedades();
    } catch (e) {
      setErroForm(
        e instanceof Error
          ? e.message
          : 'Não foi possível apagar a propriedade',
      );
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Propriedades</h1>
        <Button onClick={abrirCriar}>Nova propriedade</Button>
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
              <TableHead numeric>Área (ha)</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {propriedades.map((propriedade) => (
              <TableRow key={propriedade.id}>
                <TableCell>{propriedade.nome}</TableCell>
                <TableCell numeric>{propriedade.areaHa}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirEditar(propriedade)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirApagar(propriedade)}
                    >
                      Apagar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {propriedades.length === 0 && (
              <TableRow>
                <TableCell
                  className="text-sm text-muted-foreground"
                  colSpan={3}
                >
                  Nenhuma propriedade cadastrada.
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
          modal?.tipo === 'editar' ? 'Editar propriedade' : 'Nova propriedade'
        }
      >
        <form onSubmit={aoSalvar} className="space-y-4">
          <Input
            label="Nome"
            required
            maxLength={120}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Input
            label="Área (ha)"
            type="number"
            min="0.01"
            step="0.01"
            max={1000000}
            required
            value={areaHa}
            onChange={(e) => setAreaHa(e.target.value)}
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
        title="Apagar propriedade"
      >
        {modal?.tipo === 'apagar' && (
          <div className="space-y-4">
            <p className="text-sm">
              Tem certeza que quer apagar{' '}
              <strong>{modal.propriedade.nome}</strong>? Essa ação não pode ser
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
