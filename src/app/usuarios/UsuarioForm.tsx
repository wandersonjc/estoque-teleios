"use client";

// ============================================================
// Módulo 1 - Usuários: formulário (componente de cliente)
// O mesmo formulário serve para cadastrar e para editar.
// Na edição, o campo de senha em branco mantém a senha atual.
// ============================================================

import Link from "next/link";
import { useActionState } from "react";

import {
  LIMITE_EMAIL,
  LIMITE_NOME_USUARIO,
  SENHA_MINIMA,
  VALORES_FORMULARIO_USUARIO_VAZIOS,
  type EstadoFormularioUsuario,
  type ValoresFormularioUsuario,
} from "./tipos";

type Props = {
  // Ação do servidor que grava (criarUsuario ou atualizarUsuario)
  acao: (
    estadoAnterior: EstadoFormularioUsuario,
    formData: FormData
  ) => Promise<EstadoFormularioUsuario>;
  textoBotao: string;
  // Preenchido apenas na edição
  id?: number;
  valoresIniciais?: ValoresFormularioUsuario;
  // Na edição a senha é opcional (em branco = manter a atual)
  ehEdicao?: boolean;
};

// Campos altos (48px) e com fonte de 16px: uso em pé, no celular
const CLASSE_CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900";
const CLASSE_ROTULO = "text-base font-medium text-zinc-800";

export default function UsuarioForm({
  acao,
  textoBotao,
  id,
  valoresIniciais,
  ehEdicao = false,
}: Props) {
  const [estado, enviarFormulario, salvando] = useActionState(acao, {
    valores: valoresIniciais ?? VALORES_FORMULARIO_USUARIO_VAZIOS,
  });

  const valores = estado.valores;
  const erros = estado.erros ?? {};

  return (
    <form action={enviarFormulario} className="flex flex-col gap-4">
      {/* O id só existe na edição */}
      {id !== undefined && <input type="hidden" name="id" value={id} />}

      {estado.erroGeral && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-red-700">
          {estado.erroGeral}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="nome" className={CLASSE_ROTULO}>
          Nome <span className="text-red-700">*</span>
        </label>
        <input
          id="nome"
          name="nome"
          type="text"
          required
          maxLength={LIMITE_NOME_USUARIO}
          defaultValue={valores.nome}
          aria-invalid={erros.nome ? true : undefined}
          placeholder="Ex.: Maria Silva"
          className={CLASSE_CAMPO}
        />
        {erros.nome && <p className="text-sm text-red-700">{erros.nome}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className={CLASSE_ROTULO}>
          E-mail <span className="text-red-700">*</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          maxLength={LIMITE_EMAIL}
          defaultValue={valores.email}
          aria-invalid={erros.email ? true : undefined}
          placeholder="nome@empresa.com.br"
          autoComplete="off"
          className={CLASSE_CAMPO}
        />
        {erros.email && <p className="text-sm text-red-700">{erros.email}</p>}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="senha" className={CLASSE_ROTULO}>
          {ehEdicao ? "Nova senha" : "Senha"}{" "}
          {!ehEdicao && <span className="text-red-700">*</span>}
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required={!ehEdicao}
          autoComplete="new-password"
          aria-invalid={erros.senha ? true : undefined}
          placeholder={`Mínimo ${SENHA_MINIMA} caracteres`}
          className={CLASSE_CAMPO}
        />
        <p className="text-sm text-zinc-500">
          {ehEdicao
            ? "Deixe em branco para manter a senha atual."
            : "A senha é guardada com segurança e nunca aparece nas telas."}
        </p>
        {erros.senha && <p className="text-sm text-red-700">{erros.senha}</p>}
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
          href="/usuarios"
          className="flex h-12 items-center justify-center rounded-lg border border-zinc-300 px-5 text-base font-medium text-zinc-900"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
