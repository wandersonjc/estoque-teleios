"use client";

// ============================================================
// Módulo 1 - Locais de estoque: formulário (componente de cliente)
// Mesmo formulário para cadastrar e para renomear um local.
// ============================================================

import Link from "next/link";
import { useActionState } from "react";

import {
  LIMITE_NOME_LOCAL,
  VALORES_FORMULARIO_LOCAL_VAZIOS,
  type EstadoFormularioLocal,
  type ValoresFormularioLocal,
} from "./tipos";

type Props = {
  // Ação do servidor que grava (criarLocal ou atualizarLocal)
  acao: (
    estadoAnterior: EstadoFormularioLocal,
    formData: FormData
  ) => Promise<EstadoFormularioLocal>;
  textoBotao: string;
  // Preenchido apenas na edição
  id?: number;
  valoresIniciais?: ValoresFormularioLocal;
};

const CLASSE_CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900";

export default function LocalForm({
  acao,
  textoBotao,
  id,
  valoresIniciais,
}: Props) {
  const [estado, enviarFormulario, salvando] = useActionState(acao, {
    valores: valoresIniciais ?? VALORES_FORMULARIO_LOCAL_VAZIOS,
  });

  const valores = estado.valores;

  return (
    <form action={enviarFormulario} className="flex flex-col gap-4">
      {id !== undefined && <input type="hidden" name="id" value={id} />}

      {estado.erroGeral && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 p-3 text-base text-red-700"
        >
          {estado.erroGeral}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label
          htmlFor="nome"
          className="text-base font-medium text-zinc-800"
        >
          Nome do local <span className="text-red-700">*</span>
        </label>
        <input
          id="nome"
          name="nome"
          type="text"
          required
          maxLength={LIMITE_NOME_LOCAL}
          defaultValue={valores.nome}
          aria-invalid={estado.erroNome ? true : undefined}
          placeholder="Ex.: Loja Mesquita"
          className={CLASSE_CAMPO}
        />
        {estado.erroNome && (
          <p className="text-sm text-red-700">{estado.erroNome}</p>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={salvando}
          className="h-12 rounded-lg bg-zinc-900 px-5 text-base font-medium text-white disabled:opacity-60"
        >
          {salvando ? "Salvando..." : textoBotao}
        </button>
        <Link
          href="/locais"
          className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-900"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
