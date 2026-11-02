"use client";

// ============================================================
// Módulo 1 - Login: formulário (componente de cliente)
// useActionState mostra o erro devolvido pelo servidor e o
// indicador de carregamento enquanto a sessão é criada.
// ============================================================

import { useActionState, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { IconeCarregando } from "@/components/icones";
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
  const [envioIniciado, setEnvioIniciado] = useState(false);
  const envioIniciadoRef = useRef(false);
  const inicioEnvioRef = useRef<number | null>(null);
  const estadoAnteriorRef = useRef(estado);
  const aguardandoFeedback = entrando || envioIniciado;

  useEffect(() => {
    if (estado === estadoAnteriorRef.current) return;
    estadoAnteriorRef.current = estado;
    if (!envioIniciadoRef.current || inicioEnvioRef.current === null) return;

    const tempoRestante = Math.max(
      0,
      450 - (Date.now() - inicioEnvioRef.current)
    );
    const temporizador = setTimeout(() => {
      envioIniciadoRef.current = false;
      inicioEnvioRef.current = null;
      setEnvioIniciado(false);
    }, tempoRestante);

    return () => clearTimeout(temporizador);
  }, [estado]);

  return (
    <form
      action={enviarFormulario}
      onSubmit={(evento) => {
        if (envioIniciadoRef.current) {
          evento.preventDefault();
          return;
        }
        envioIniciadoRef.current = true;
        inicioEnvioRef.current = Date.now();
        flushSync(() => setEnvioIniciado(true));
      }}
      className="flex flex-col gap-4"
    >
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
        disabled={aguardandoFeedback}
        aria-busy={aguardandoFeedback}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 text-base font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {aguardandoFeedback ? (
          <>
            <IconeCarregando className="h-5 w-5 animate-spin" />
            Entrando...
          </>
        ) : (
          "Entrar"
        )}
      </button>
    </form>
  );
}
