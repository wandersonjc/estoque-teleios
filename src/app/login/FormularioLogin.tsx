"use client";

// ============================================================
// Módulo 1 - Login: formulário (componente de cliente)
// useActionState mostra o erro devolvido pelo servidor e o
// indicador de carregamento enquanto a sessão é criada.
// ============================================================

import { useActionState } from "react";

import { entrar } from "./actions";
import { VALORES_LOGIN_VAZIOS, type EstadoLogin } from "./tipos";

const CLASSE_CAMPO =
  "h-12 w-full rounded-lg border border-zinc-300 bg-white px-3 text-base text-zinc-900 outline-none focus:border-zinc-900";
const CLASSE_ROTULO = "text-base font-medium text-zinc-800";

export default function FormularioLogin() {
  const [estado, enviarFormulario, entrando] = useActionState<
    EstadoLogin,
    FormData
  >(entrar, { valores: VALORES_LOGIN_VAZIOS });

  return (
    <form action={enviarFormulario} className="flex flex-col gap-4">
      {estado.erroGeral && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-base text-red-700">
          {estado.erroGeral}
        </p>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className={CLASSE_ROTULO}>
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={estado.valores.email}
          placeholder="nome@empresa.com.br"
          className={CLASSE_CAMPO}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="senha" className={CLASSE_ROTULO}>
          Senha
        </label>
        <input
          id="senha"
          name="senha"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Sua senha"
          className={CLASSE_CAMPO}
        />
      </div>

      <button
        type="submit"
        disabled={entrando}
        className="h-12 rounded-lg bg-zinc-900 px-5 text-base font-medium text-white disabled:opacity-60"
      >
        {entrando ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
