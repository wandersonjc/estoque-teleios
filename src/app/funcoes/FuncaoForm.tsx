"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  LIMITE_NOME_FUNCAO,
  VALORES_FORMULARIO_FUNCAO_VAZIOS,
  type EstadoFormularioFuncao,
  type ValoresFormularioFuncao,
} from "./tipos";

type Props = {
  acao: (
    estadoAnterior: EstadoFormularioFuncao,
    formData: FormData
  ) => Promise<EstadoFormularioFuncao>;
  textoBotao: string;
  id?: number;
  valoresIniciais?: ValoresFormularioFuncao;
};

const CLASSE_CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900";

export default function FuncaoForm({
  acao,
  textoBotao,
  id,
  valoresIniciais,
}: Props) {
  const [estado, enviarFormulario, salvando] = useActionState(acao, {
    valores: valoresIniciais ?? VALORES_FORMULARIO_FUNCAO_VAZIOS,
  });
  const valores = estado.valores;

  return (
    <form action={enviarFormulario} className="flex flex-col gap-4">
      {id !== undefined && <input type="hidden" name="id" value={id} />}
      {estado.erroGeral && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-red-700">
          {estado.erroGeral}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="nome-funcao" className="text-base font-medium text-zinc-800">
          Nome da função <span className="text-red-700">*</span>
        </label>
        <input
          id="nome-funcao"
          name="nome"
          type="text"
          required
          maxLength={LIMITE_NOME_FUNCAO}
          defaultValue={valores.nome}
          aria-invalid={estado.erros?.nome ? true : undefined}
          className={CLASSE_CAMPO}
        />
        {estado.erros?.nome && (
          <p className="text-sm text-red-700">{estado.erros.nome}</p>
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
          href="/funcoes"
          className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-900"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
