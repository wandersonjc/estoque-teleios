"use client";

// ============================================================
// Módulo 2 - Formulário para vincular produto e fornecedor (RN-09)
// Usado na tela do fornecedor (escolhe o produto) e na tela do
// produto (escolhe o fornecedor).
// ============================================================

import { useActionState } from "react";

import { vincularProdutoFornecedor } from "./actions";
import {
  LIMITE_CODIGO_NO_FORNECEDOR,
  VALORES_VINCULO_VAZIOS,
  type EstadoFormularioVinculo,
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

export default function FormularioVinculo({
  produtoId,
  fornecedorId,
  opcoes,
  retorno,
}: Props) {
  const [estado, enviar, enviando] = useActionState<
    EstadoFormularioVinculo,
    FormData
  >(vincularProdutoFornecedor, { valores: VALORES_VINCULO_VAZIOS });

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
          {escolherProduto
            ? "Não há produtos ativos para vincular."
            : "Não há fornecedores ativos para vincular."}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={escolherProduto ? "produtoId" : "fornecedorId"}
              className={CLASSE_ROTULO}
            >
              {escolherProduto ? "Produto" : "Fornecedor"}
            </label>
            <select
              id={escolherProduto ? "produtoId" : "fornecedorId"}
              name={escolherProduto ? "produtoId" : "fornecedorId"}
              defaultValue={
                escolherProduto
                  ? estado.valores.produtoId
                  : estado.valores.fornecedorId
              }
              className={CLASSE_CAMPO}
              aria-invalid={
                (escolherProduto ? erros.produtoId : erros.fornecedorId)
                  ? true
                  : undefined
              }
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

          <div className="flex flex-col gap-1">
            <label htmlFor="codigoNoFornecedor" className={CLASSE_ROTULO}>
              Código no fornecedor
            </label>
            <input
              id="codigoNoFornecedor"
              name="codigoNoFornecedor"
              type="text"
              maxLength={LIMITE_CODIGO_NO_FORNECEDOR}
              defaultValue={estado.valores.codigoNoFornecedor}
              placeholder="Opcional"
              className={CLASSE_CAMPO}
            />
            {erros.codigoNoFornecedor && (
              <p className="text-sm text-red-700">{erros.codigoNoFornecedor}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="h-12 rounded-lg bg-zinc-900 px-4 text-base font-medium text-white disabled:opacity-60"
          >
            {enviando ? "Vinculando..." : "Vincular"}
          </button>
        </>
      )}
    </form>
  );
}
