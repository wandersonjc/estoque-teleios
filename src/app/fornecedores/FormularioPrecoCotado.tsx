"use client";

// ============================================================
// Módulo 2 - Registrar preço cotado (RN-10, origem COTADO)
// Sem pedido: o comprador informa o preço de uma consulta.
// ============================================================

import { useActionState } from "react";

import { registrarPrecoCotado } from "./actions";
import {
  VALORES_PRECO_VAZIOS,
  dataHojeIso,
  type EstadoFormularioPreco,
} from "./tipos";

type Opcao = { id: number; nome: string };

type Props = {
  produtoId?: number;
  fornecedorId?: number;
  opcoes: Opcao[];
  retorno: string;
};

const CLASSE_CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900";
const CLASSE_ROTULO = "text-base font-medium text-zinc-800";

export default function FormularioPrecoCotado({
  produtoId,
  fornecedorId,
  opcoes,
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
              defaultValue={
                escolherProduto
                  ? estado.valores.produtoId
                  : estado.valores.fornecedorId
              }
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
              <label htmlFor="precoUnitario" className={CLASSE_ROTULO}>
                Preço unitário (R$)
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
