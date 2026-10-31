"use client";

// ============================================================
// Módulo 2 - Fornecedores: formulário de cadastro/edição
// Prazo de entrega, pedido mínimo e frete são opcionais (RN-17).
// ============================================================

import Link from "next/link";
import { useActionState } from "react";
import CampoImagem from "@/components/CampoImagem";

import {
  LIMITE_CONTATO_FORNECEDOR,
  LIMITE_NOME_FORNECEDOR,
  VALORES_FORNECEDOR_VAZIOS,
  type EstadoFormularioFornecedor,
  type ValoresFormularioFornecedor,
} from "./tipos";

type Props = {
  acao: (
    estadoAnterior: EstadoFormularioFornecedor,
    formData: FormData
  ) => Promise<EstadoFormularioFornecedor>;
  textoBotao: string;
  id?: number;
  valoresIniciais?: ValoresFormularioFornecedor;
  imagemUrl?: string;
};

const CLASSE_CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900";
const CLASSE_ROTULO = "text-base font-medium text-zinc-800";

export default function FormularioFornecedor({
  acao,
  textoBotao,
  id,
  valoresIniciais,
  imagemUrl,
}: Props) {
  const [estado, enviarFormulario, enviando] = useActionState(acao, {
    valores: valoresIniciais ?? VALORES_FORNECEDOR_VAZIOS,
  });

  const erros = estado.erros ?? {};

  return (
    <form action={enviarFormulario} className="mt-4 flex flex-col gap-4">
      {id !== undefined && <input type="hidden" name="id" value={id} />}

      {estado.erroGeral && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-red-700">
          {estado.erroGeral}
        </p>
      )}

      <CampoImagem imagemUrl={imagemUrl} textoAlternativo="Imagem do fornecedor" />

      <div className="flex flex-col gap-1">
        <label htmlFor="nome" className={CLASSE_ROTULO}>
          Nome <span className="text-red-700">*</span>
        </label>
        <input
          id="nome"
          name="nome"
          type="text"
          required
          maxLength={LIMITE_NOME_FORNECEDOR}
          defaultValue={estado.valores.nome}
          aria-invalid={erros.nome ? true : undefined}
          placeholder="Ex.: Distribuidora Alimentos Ltda"
          className={CLASSE_CAMPO}
        />
        {erros.nome && <p className="text-sm text-red-700">{erros.nome}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="contato" className={CLASSE_ROTULO}>
          Contato
        </label>
        <textarea
          id="contato"
          name="contato"
          rows={3}
          maxLength={LIMITE_CONTATO_FORNECEDOR}
          defaultValue={estado.valores.contato}
          aria-invalid={erros.contato ? true : undefined}
          placeholder="Telefone, e-mail, nome do vendedor..."
          className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-base text-zinc-900 outline-none focus:border-zinc-900"
        />
        {erros.contato && (
          <p className="text-sm text-red-700">{erros.contato}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="prazoEntregaDias" className={CLASSE_ROTULO}>
            Prazo de entrega (dias)
          </label>
          <input
            id="prazoEntregaDias"
            name="prazoEntregaDias"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            defaultValue={estado.valores.prazoEntregaDias}
            aria-invalid={erros.prazoEntregaDias ? true : undefined}
            placeholder="Ex.: 7"
            className={CLASSE_CAMPO}
          />
          {erros.prazoEntregaDias && (
            <p className="text-sm text-red-700">{erros.prazoEntregaDias}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="valorMinimoPedido" className={CLASSE_ROTULO}>
            Pedido mínimo (R$)
          </label>
          <input
            id="valorMinimoPedido"
            name="valorMinimoPedido"
            type="text"
            inputMode="decimal"
            defaultValue={estado.valores.valorMinimoPedido}
            aria-invalid={erros.valorMinimoPedido ? true : undefined}
            placeholder="Opcional"
            className={CLASSE_CAMPO}
          />
          {erros.valorMinimoPedido && (
            <p className="text-sm text-red-700">{erros.valorMinimoPedido}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="frete" className={CLASSE_ROTULO}>
            Frete (R$)
          </label>
          <input
            id="frete"
            name="frete"
            type="text"
            inputMode="decimal"
            defaultValue={estado.valores.frete}
            aria-invalid={erros.frete ? true : undefined}
            placeholder="Opcional"
            className={CLASSE_CAMPO}
          />
          {erros.frete && <p className="text-sm text-red-700">{erros.frete}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <button
          type="submit"
          disabled={enviando}
          className="h-12 flex-1 rounded-lg bg-zinc-900 px-6 text-base font-medium text-white disabled:opacity-60"
        >
          {enviando ? "Salvando..." : textoBotao}
        </button>
        <Link
          href="/fornecedores"
          className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-6 text-base font-medium text-zinc-900"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
