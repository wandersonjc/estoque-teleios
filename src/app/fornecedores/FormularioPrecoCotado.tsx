"use client";

// ============================================================
// Módulo 2 - Registrar preço cotado (RN-10, origem COTADO)
// Sem pedido: o comprador informa o preço de uma consulta.
// ============================================================

import { useActionState, useState } from "react";

import { registrarPrecoCotado } from "./actions";
import {
  VALORES_PRECO_VAZIOS,
  dataHojeIso,
  type EstadoFormularioPreco,
} from "./tipos";

type UnidadePreco = {
  valor: string;
  unidade: string;
  fator: string;
};

type Opcao = {
  id: number;
  nome: string;
  unidades?: UnidadePreco[];
};

type Props = {
  produtoId?: number;
  fornecedorId?: number;
  opcoes: Opcao[];
  unidades?: UnidadePreco[];
  retorno: string;
};

const CLASSE_CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900";
const CLASSE_ROTULO = "text-base font-medium text-zinc-800";

export default function FormularioPrecoCotado({
  produtoId,
  fornecedorId,
  opcoes,
  unidades,
  retorno,
}: Props) {
  const [estado, enviar, enviando] = useActionState<
    EstadoFormularioPreco,
    FormData
  >(registrarPrecoCotado, {
    valores: { ...VALORES_PRECO_VAZIOS, data: dataHojeIso() },
  });

  const erros = estado.erros ?? {};
  const escolherProduto = produtoId === undefined;
  const [opcaoSelecionada, setOpcaoSelecionada] = useState(
    escolherProduto
      ? String(produtoId ?? "")
      : String(fornecedorId ?? "")
  );
  const [unidadeSelecionada, setUnidadeSelecionada] = useState("BASE");
  const unidadesDisponiveis =
    opcoes.find((opcao) => String(opcao.id) === opcaoSelecionada)?.unidades ??
    unidades ??
    [];

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <input type="hidden" name="retorno" value={retorno} />
      {produtoId !== undefined && (
        <input type="hidden" name="produtoId" value={produtoId} />
      )}
      {fornecedorId !== undefined && (
        <input type="hidden" name="fornecedorId" value={fornecedorId} />
      )}

      {estado.erroGeral && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-red-700">
          {estado.erroGeral}
        </p>
      )}

      {opcoes.length === 0 ? (
        <p className="text-base text-zinc-600">
          Vincule um produto a este fornecedor para registrar o preço.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={escolherProduto ? "produtoId-preco" : "fornecedorId-preco"}
              className={CLASSE_ROTULO}
            >
              {escolherProduto ? "Produto" : "Fornecedor"}
            </label>
            <select
              id={escolherProduto ? "produtoId-preco" : "fornecedorId-preco"}
              name={escolherProduto ? "produtoId" : "fornecedorId"}
              value={opcaoSelecionada}
              onChange={(evento) => {
                setOpcaoSelecionada(evento.target.value);
                setUnidadeSelecionada("BASE");
              }}
              className={CLASSE_CAMPO}
            >
              <option value="">Selecione</option>
              {opcoes.map((opcao) => (
                <option key={opcao.id} value={opcao.id}>
                  {opcao.nome}
                </option>
              ))}
            </select>
            {escolherProduto && erros.produtoId && (
              <p className="text-sm text-red-700">{erros.produtoId}</p>
            )}
            {!escolherProduto && erros.fornecedorId && (
              <p className="text-sm text-red-700">{erros.fornecedorId}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="unidadeSelecionada-preco" className={CLASSE_ROTULO}>
                Embalagem do preço
              </label>
              <select
                id="unidadeSelecionada-preco"
                name="unidadeSelecionada"
                value={unidadeSelecionada}
                onChange={(evento) => setUnidadeSelecionada(evento.target.value)}
                className={CLASSE_CAMPO}
                aria-invalid={erros.unidadeSelecionada ? true : undefined}
              >
                {unidadesDisponiveis.length === 0 ? (
                  <option value="BASE">Selecione primeiro um produto ou fornecedor</option>
                ) : (
                  unidadesDisponiveis.map((unidade) => (
                    <option key={unidade.valor} value={unidade.valor}>
                      {unidade.unidade}
                      {Number(unidade.fator) !== 1
                        ? ` (${new Intl.NumberFormat("pt-BR", {
                            maximumFractionDigits: 3,
                          }).format(Number(unidade.fator))} ${unidadesDisponiveis[0]?.unidade})`
                        : ""}
                    </option>
                  ))
                )}
              </select>
              {erros.unidadeSelecionada && (
                <p className="text-sm text-red-700">{erros.unidadeSelecionada}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="precoUnitario" className={CLASSE_ROTULO}>
                Preço por unidade selecionada (R$)
              </label>
              <input
                id="precoUnitario"
                name="precoUnitario"
                type="text"
                inputMode="decimal"
                defaultValue={estado.valores.precoUnitario}
                placeholder="0,00"
                className={CLASSE_CAMPO}
                aria-invalid={erros.precoUnitario ? true : undefined}
              />
              {erros.precoUnitario && (
                <p className="text-sm text-red-700">{erros.precoUnitario}</p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="data" className={CLASSE_ROTULO}>
                Data da cotação
              </label>
              <input
                id="data"
                name="data"
                type="date"
                defaultValue={estado.valores.data || dataHojeIso()}
                className={CLASSE_CAMPO}
                aria-invalid={erros.data ? true : undefined}
              />
              {erros.data && (
                <p className="text-sm text-red-700">{erros.data}</p>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="h-12 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white disabled:opacity-60"
          >
            {enviando ? "Registrando..." : "Registrar preço cotado"}
          </button>
        </>
      )}
    </form>
  );
}
