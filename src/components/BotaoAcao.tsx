"use client";

// ============================================================
// Botão de envio de formulário com indicador de carregamento.
// O useFormStatus avisa quando o formulário (a Server Action)
// está sendo enviado: enquanto isso, o botão fica desabilitado e
// mostra uma roda no lugar do conteúdo.
// Use sempre DENTRO de um <form>, no lugar do <button type="submit">.
// ============================================================

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { IconeCarregando } from "@/components/icones";

type Props = {
  // Conteúdo normal do botão (ícone, texto, pill, etc.)
  children: ReactNode;
  // Conteúdo mostrado durante o envio (por padrão, uma roda)
  carregando?: ReactNode;
  className?: string;
  title?: string;
  // Rótulo para leitores de tela (quando o botão só tem ícone)
  ariaLabel?: string;
};

export default function BotaoAcao({
  children,
  carregando,
  className = "",
  title,
  ariaLabel,
}: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      title={title}
      aria-label={ariaLabel}
      aria-busy={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending
        ? carregando ?? <IconeCarregando className="h-5 w-5 animate-spin" />
        : children}
    </button>
  );
}
