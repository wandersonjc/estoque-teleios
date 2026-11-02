"use client";

import Link from "next/link";
import { useId, useState, useActionState } from "react";

import {
  MAX_ITENS_TRANSFERENCIA,
  VALORES_TRANSFERENCIA_VAZIOS,
  type EstadoFormularioTransferencia,
  type ItemFormularioTransferencia,
  type ProdutoTransferencia,
  type ValoresFormularioTransferencia,
} from "./tipos";

type Props = {
  acao: (
    estadoAnterior: EstadoFormularioTransferencia,
    formData: FormData
  ) => Promise<EstadoFormularioTransferencia>;
  locais: { id: number; nome: string }[];
  produtos: ProdutoTransferencia[];
  textoBotao: string;
  valoresIniciais?: ValoresFormularioTransferencia;
  idPedido?: number;
};

const CLASSE_CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900";

export default function FormularioTransferencia({
  acao,
  locais,
  produtos,
  textoBotao,
  valoresIniciais = VALORES_TRANSFERENCIA_VAZIOS,
  idPedido,
}: Props) {
  const [estado, enviar, salvando] = useActionState(acao, {
    valores: valoresIniciais,
  });
  const [origemId, setOrigemId] = useState(estado.valores.origemId);
  const [destinoId, setDestinoId] = useState(estado.valores.destinoId);
  const [itens, setItens] = useState<ItemFormularioTransferencia[]>(
    estado.valores.itens.length > 0
      ? estado.valores.itens
      : [{ produtoId: "", quantidade: "", embalagemId: "" }]
  );
  const idBase = useId();
  const itensJson = JSON.stringify(itens);

  function atualizarItem(
    indice: number,
    campo: keyof ItemFormularioTransferencia,
    valor: string
  ) {
    setItens((atuais) =>
      atuais.map((item, posicao) =>
        posicao === indice ? { ...item, [campo]: valor } : item
      )
    );
  }

  function removerItem(indice: number) {
    setItens((atuais) => atuais.filter((_, posicao) => posicao !== indice));
  }

  return (
    <form action={enviar} className="flex flex-col gap-5">
      {idPedido !== undefined && (
        <input type="hidden" name="id" value={idPedido} />
      )}
      <input type="hidden" name="itensJson" value={itensJson} />

      {estado.erroGeral && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {estado.erroGeral}
        </p>
      )}

      <section className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idBase}-origem`} className="text-sm font-medium text-zinc-800">
            Local de origem <span className="text-red-700">*</span>
          </label>
          <select
            id={`${idBase}-origem`}
            name="origemId"
            required
            value={origemId}
            onChange={(evento) => setOrigemId(evento.target.value)}
            className={CLASSE_CAMPO}
          >
            <option value="">Selecione</option>
            {locais.map((local) => (
              <option key={local.id} value={local.id}>
                {local.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idBase}-destino`} className="text-sm font-medium text-zinc-800">
            Local de destino <span className="text-red-700">*</span>
          </label>
          <select
            id={`${idBase}-destino`}
            name="destinoId"
            required
            value={destinoId}
            onChange={(evento) => setDestinoId(evento.target.value)}
            className={CLASSE_CAMPO}
          >
            <option value="">Selecione</option>
            {locais.map((local) => (
              <option
                key={local.id}
                value={local.id}
                disabled={String(local.id) === origemId}
              >
                {local.nome}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Produtos</h2>
            <p className="text-sm text-zinc-600">
              Selecione uma embalagem cadastrada ou use a unidade-base. O estoque
              é convertido e armazenado na unidade-base.
            </p>
          </div>
          <button
            type="button"
            disabled={itens.length >= MAX_ITENS_TRANSFERENCIA}
            onClick={() =>
              setItens((atuais) => [
                ...atuais,
                { produtoId: "", quantidade: "", embalagemId: "" },
              ])
            }
            className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-900 disabled:opacity-50"
          >
            Adicionar produto
          </button>
        </div>

        {produtos.length === 0 ? (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Não há produtos ativos disponíveis para incluir.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            {itens.map((item, indice) => {
              const produtoSelecionado = produtos.find(
                (produto) => String(produto.id) === item.produtoId
              );
              const embalagemSelecionada = produtoSelecionado?.embalagens.find(
                (embalagem) => String(embalagem.id) === item.embalagemId
              );
              const unidadeQuantidade =
                embalagemSelecionada?.unidade ?? produtoSelecionado?.unidade;
              const idsUsados = new Set(
                itens
                  .filter((_, posicao) => posicao !== indice)
                  .map((linha) => linha.produtoId)
              );
              return (
                <fieldset
                  key={`${idBase}-item-${indice}`}
                  className="grid gap-3 rounded-lg border border-zinc-200 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(10rem,0.7fr)_minmax(9rem,0.5fr)_auto] xl:items-end"
                >
                  <legend className="px-1 text-sm font-medium text-zinc-700">
                    Produto {indice + 1}
                  </legend>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`${idBase}-produto-${indice}`}
                      className="text-sm font-medium text-zinc-800"
                    >
                      Produto
                    </label>
                    <select
                      id={`${idBase}-produto-${indice}`}
                      required
                      value={item.produtoId}
                      onChange={(evento) =>
                        setItens((atuais) =>
                          atuais.map((linha, posicao) =>
                            posicao === indice
                              ? {
                                  ...linha,
                                  produtoId: evento.target.value,
                                  embalagemId: "",
                                  quantidade: "",
                                }
                              : linha
                          )
                        )
                      }
                      className={CLASSE_CAMPO}
                    >
                      <option value="">Selecione</option>
                      {produtos.map((produto) => (
                        <option
                          key={produto.id}
                          value={produto.id}
                          disabled={idsUsados.has(String(produto.id))}
                        >
                          {produto.nome} ({produto.unidade})
                        </option>
                      ))}
                    </select>
                  </div>
                  {produtoSelecionado && produtoSelecionado.embalagens.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <label
                        htmlFor={`${idBase}-embalagem-${indice}`}
                        className="text-sm font-medium text-zinc-800"
                      >
                        Tipo de embalagem
                      </label>
                      <select
                        id={`${idBase}-embalagem-${indice}`}
                        value={item.embalagemId}
                        onChange={(evento) => {
                          atualizarItem(indice, "embalagemId", evento.target.value);
                          atualizarItem(indice, "quantidade", "");
                        }}
                        className={CLASSE_CAMPO}
                      >
                        <option value="">
                          Unidade-base ({produtoSelecionado.unidade})
                        </option>
                        {produtoSelecionado.embalagens.map((embalagem) => (
                          <option key={embalagem.id} value={embalagem.id}>
                            {embalagem.unidade} · 1 equivale a{" "}
                            {embalagem.quantidadeBase} {produtoSelecionado.unidade}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`${idBase}-quantidade-${indice}`}
                      className="text-sm font-medium text-zinc-800"
                    >
                      Quantidade solicitada
                      {unidadeQuantidade ? ` (${unidadeQuantidade})` : ""}
                    </label>
                    <input
                      id={`${idBase}-quantidade-${indice}`}
                      type="text"
                      inputMode="decimal"
                      required
                      value={item.quantidade}
                      onChange={(evento) =>
                        atualizarItem(indice, "quantidade", evento.target.value)
                      }
                      className={CLASSE_CAMPO}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={itens.length <= 1}
                    onClick={() => removerItem(indice)}
                    aria-label={`Remover produto ${indice + 1}`}
                    className="min-h-11 rounded-lg border border-zinc-300 px-3 text-sm font-medium text-zinc-800 disabled:opacity-50"
                  >
                    Remover
                  </button>
                </fieldset>
              );
            })}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={salvando || produtos.length === 0}
          className="h-12 rounded-lg bg-zinc-900 px-5 text-base font-medium text-white disabled:opacity-60"
        >
          {salvando ? "Salvando..." : textoBotao}
        </button>
        <Link
          href="/transferencias"
          className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-900"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
