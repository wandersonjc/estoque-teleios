"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { IconeCarregando } from "@/components/icones";
import QuantidadesEquivalentes from "../../QuantidadesEquivalentes";
import { ROTULO_SITUACAO_ORCAMENTO, type SituacaoOrcamento } from "../../tipos";
import { editarSolicitacaoOrcamento } from "../../actions";

type Unidade = {
  valor: string;
  rotulo: string;
  unidade: string;
  fatorConversao: string;
};

export type ProdutoEditavel = {
  produtoId: number;
  nome: string;
  codigoERP: string | null;
  ativo: boolean;
  situacao: SituacaoOrcamento | null;
  estoque: string;
  quantidadeSugerida: string;
  unidadeBase: string;
  embalagens: { unidade: string; fatorConversao: string }[];
  fornecedores: string[];
  selecionado: boolean;
  quantidade: string;
  unidade: string;
  unidades: Unidade[];
};

type Props = {
  solicitacaoId: string;
  fornecedor: string;
  produtosIniciais: ProdutoEditavel[];
};

export default function FormularioEdicaoOrcamento({
  solicitacaoId,
  fornecedor,
  produtosIniciais,
}: Props) {
  const router = useRouter();
  const [produtos, setProdutos] = useState(produtosIniciais);
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, iniciarTransicao] = useTransition();

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    if (!termo) return produtos;
    return produtos.filter(
      (produto) =>
        produto.nome.toLocaleLowerCase("pt-BR").includes(termo) ||
        produto.codigoERP?.toLocaleLowerCase("pt-BR").includes(termo)
    );
  }, [busca, produtos]);

  function atualizarProduto(
    produtoId: number,
    atualizacao: Partial<ProdutoEditavel>
  ) {
    setProdutos((atuais) =>
      atuais.map((produto) =>
        produto.produtoId === produtoId
          ? { ...produto, ...atualizacao }
          : produto
      )
    );
  }

  function salvar() {
    if (ocupado) return;
    const itens = produtos
      .filter((produto) => produto.selecionado)
      .map((produto) => ({
        produtoId: produto.produtoId,
        quantidade: produto.quantidade,
        unidade: produto.unidade,
      }));
    if (itens.length === 0) {
      setErro("Selecione ao menos um produto para a solicitação.");
      return;
    }

    setErro("");
    iniciarTransicao(async () => {
      const resposta = await editarSolicitacaoOrcamento({
        id: solicitacaoId,
        itens,
      });
      if (resposta.erro) {
        setErro(resposta.erro);
        return;
      }
      router.push(`/orcamento/${solicitacaoId}`);
      router.refresh();
    });
  }

  return (
    <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">
            Produtos da solicitação
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            Fornecedor: {fornecedor}. Adicione ou remova produtos e ajuste
            quantidades e unidades.
          </p>
        </div>
        <div className="flex flex-col gap-1 sm:w-72">
          <label
            htmlFor="busca-produtos-edicao-orcamento"
            className="text-sm font-medium text-zinc-800"
          >
            Buscar produto
          </label>
          <input
            id="busca-produtos-edicao-orcamento"
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.currentTarget.value)}
            placeholder="Nome ou código ERP"
            className="h-11 w-full rounded-lg border border-zinc-300 px-3 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full min-w-[1250px] border-collapse text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr className="border-b border-zinc-200">
              <th scope="col" className="px-3 py-3 font-semibold">Incluir</th>
              <th scope="col" className="px-3 py-3 font-semibold">Produto</th>
              <th scope="col" className="px-3 py-3 font-semibold">Situação</th>
              <th scope="col" className="px-3 py-3 font-semibold">Estoque</th>
              <th scope="col" className="px-3 py-3 font-semibold">Sugestão</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Fornecedores</th>
              <th scope="col" className="px-3 py-3 font-semibold">Quantidade</th>
              <th scope="col" className="px-3 py-3 font-semibold">Unidade solicitada</th>
            </tr>
          </thead>
          <tbody>
            {produtosFiltrados.map((produto) => (
              <tr
                key={produto.produtoId}
                className="border-b border-zinc-100 align-top last:border-0"
              >
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={produto.selecionado}
                    disabled={ocupado}
                    onChange={(evento) =>
                      atualizarProduto(produto.produtoId, {
                        selecionado: evento.currentTarget.checked,
                      })
                    }
                    aria-label={`Incluir ${produto.nome}`}
                    className="h-5 w-5 accent-[#002855]"
                  />
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-zinc-900">{produto.nome}</p>
                  {produto.codigoERP && (
                    <p className="mt-0.5 text-xs text-zinc-500">
                      Código ERP: {produto.codigoERP}
                    </p>
                  )}
                  {!produto.ativo && (
                    <p className="mt-0.5 text-xs text-amber-800">
                      Produto inativo; só é possível manter a unidade registrada.
                    </p>
                  )}
                </td>
                <td
                  className={`whitespace-nowrap px-3 py-3 font-medium ${
                    !produto.ativo
                      ? "text-zinc-500"
                      : produto.situacao === "CRITICO"
                        ? "text-red-700"
                        : produto.situacao === "COMPRAR"
                          ? "text-amber-700"
                          : "text-green-700"
                  }`}
                >
                  {!produto.ativo
                    ? "Inativo"
                    : produto.situacao
                      ? ROTULO_SITUACAO_ORCAMENTO[produto.situacao]
                      : "Sem configuração"}
                </td>
                <td className="px-3 py-3 text-zinc-700">
                  <QuantidadesEquivalentes
                    quantidadeBase={produto.estoque}
                    unidadeBase={produto.unidadeBase}
                    embalagens={produto.embalagens}
                  />
                </td>
                <td className="px-3 py-3 text-zinc-700">
                  <QuantidadesEquivalentes
                    quantidadeBase={produto.quantidadeSugerida}
                    unidadeBase={produto.unidadeBase}
                    embalagens={produto.embalagens}
                  />
                </td>
                <td className="max-w-64 px-3 py-3 text-zinc-700">
                  {produto.fornecedores.length > 0
                    ? produto.fornecedores.join(", ")
                    : "Sem fornecedor ativo vinculado"}
                </td>
                <td className="px-3 py-3">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={produto.quantidade}
                    disabled={ocupado || !produto.selecionado}
                    onChange={(evento) =>
                      atualizarProduto(produto.produtoId, {
                        quantidade: evento.currentTarget.value,
                      })
                    }
                    aria-label={`Quantidade de ${produto.nome}`}
                    className="h-10 w-32 rounded-lg border border-zinc-300 px-3 disabled:bg-zinc-100"
                  />
                </td>
                <td className="px-3 py-3">
                  <select
                    value={produto.unidade}
                    disabled={ocupado || !produto.selecionado}
                    onChange={(evento) =>
                      atualizarProduto(produto.produtoId, {
                        unidade: evento.currentTarget.value,
                      })
                    }
                    aria-label={`Unidade solicitada de ${produto.nome}`}
                    className="h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 disabled:bg-zinc-100"
                  >
                    {produto.unidades.map((unidade) => (
                      <option key={unidade.valor} value={unidade.valor}>
                        {unidade.rotulo}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {produtosFiltrados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-zinc-600">
                  Nenhum produto encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {erro && (
        <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {erro}
        </p>
      )}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          disabled={ocupado}
          onClick={() => router.push(`/orcamento/${solicitacaoId}`)}
          className="flex h-11 items-center justify-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={salvar}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#002855] px-4 text-sm font-medium text-white hover:bg-[#124b7e] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {ocupado && <IconeCarregando className="h-4 w-4 animate-spin" />}
          {ocupado ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </section>
  );
}
