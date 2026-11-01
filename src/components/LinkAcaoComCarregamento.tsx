"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";

import { IconeCarregando } from "@/components/icones";

type Props = {
  href: string;
  children: ReactNode;
  className: string;
  ariaLabel: string;
  title?: string;
  tamanhoIconeCarregando?: string;
};

export default function LinkAcaoComCarregamento({
  href,
  children,
  className,
  ariaLabel,
  title,
  tamanhoIconeCarregando = "h-5 w-5",
}: Props) {
  const [navegando, setNavegando] = useState(false);
  const navegacaoIniciada = useRef(false);

  return (
    <Link
      href={href}
      prefetch={false}
      title={title}
      aria-label={ariaLabel}
      aria-disabled={navegando}
      aria-busy={navegando}
      tabIndex={navegando ? -1 : undefined}
      onNavigate={(evento) => {
        if (navegacaoIniciada.current) {
          evento.preventDefault();
          return;
        }
        navegacaoIniciada.current = true;
        setNavegando(true);
      }}
      onClick={(evento) => {
        if (navegando) evento.preventDefault();
      }}
      className={`${className} ${navegando ? "pointer-events-none opacity-60" : ""}`}
    >
      {navegando ? (
        <IconeCarregando className={`${tamanhoIconeCarregando} animate-spin`} />
      ) : (
        children
      )}
    </Link>
  );
}