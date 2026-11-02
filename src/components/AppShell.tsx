"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { IconeUser } from "@/components/icones";
import IndicadorCarregando from "@/components/IndicadorCarregando";
import NotificacoesTransferencia from "@/components/NotificacoesTransferencia";
import SeletorTema from "@/components/SeletorTema";
import { sair } from "@/app/login/actions";

type ItemMenu = {
  href: string;
  rotulo: string;
};

type Props = {
  children: React.ReactNode;
  gruposDoMenu: ItemMenu[][];
  podeConsultarTransferencias: boolean;
  usuario: {
    id: number;
    nome: string;
    email: string;
    imagemUrl?: string;
    tema: "claro" | "escuro";
  };
};

function IconeMenu({ fechado = false }: { fechado?: boolean }) {
  return fechado ? (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
      <path d="M4 4v16" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function IconeNavegacao({ href }: { href: string }) {
  const paths: Record<string, React.ReactNode> = {
    "/dashboard": (
      <>
        <rect x="3" y="3" width="8" height="8" rx="1" />
        <rect x="13" y="3" width="8" height="5" rx="1" />
        <rect x="13" y="10" width="8" height="11" rx="1" />
        <rect x="3" y="13" width="8" height="8" rx="1" />
      </>
    ),
    "/produtos": (
      <>
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
      </>
    ),
    "/locais": (
      <>
        <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
        <path d="M9 9h.01M15 9h.01" />
      </>
    ),
    "/fornecedores": (
      <>
        <path d="M3 21h18M5 21V7l7-4 7 4v14" />
        <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M12 21v-4" />
      </>
    ),
    "/transferencias": (
      <>
        <path d="M7 7h13l-3-3M20 7l-3 3M17 17H4l3 3M4 17l3-3" />
      </>
    ),
    "/cargos": (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5.5a3 3 0 0 1 0 5.8M18 15a5 5 0 0 1 3 4.6V21" />
      </>
    ),
    "/funcoes": (
      <>
        <path d="M4 5h16M4 12h16M4 19h16" />
        <circle cx="8" cy="5" r="2" fill="currentColor" />
        <circle cx="16" cy="12" r="2" fill="currentColor" />
        <circle cx="10" cy="19" r="2" fill="currentColor" />
      </>
    ),
    "/usuarios": (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    "/permissoes": (
      <>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="m8 10 2 2 5-5M8 16h8" />
      </>
    ),
    "/historico": (
      <>
        <path d="M3 12a9 9 0 1 0 2.64-6.36L3 8" />
        <path d="M3 3v5h5M12 7v5l3 2" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      {paths[href] ?? <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

export default function AppShell({
  children,
  gruposDoMenu,
  podeConsultarTransferencias,
  usuario,
}: Props) {
  const pathname = usePathname();
  const [menuRecolhido, setMenuRecolhido] = useState(false);
  const [menuMovelAberto, setMenuMovelAberto] = useState(false);

  useEffect(() => {
    if (!menuMovelAberto) return;

    function fecharComEscape(evento: KeyboardEvent) {
      if (evento.key === "Escape") setMenuMovelAberto(false);
    }

    window.addEventListener("keydown", fecharComEscape);
    return () => window.removeEventListener("keydown", fecharComEscape);
  }, [menuMovelAberto]);

  function alternarMenu() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setMenuRecolhido((recolhido) => !recolhido);
    } else {
      setMenuMovelAberto((aberto) => !aberto);
    }
  }

  function renderizarNavegacao(movel = false) {
    return (
      <nav aria-label="Navegação principal" className="flex flex-col">
        {gruposDoMenu.map((grupo, indice) => (
          <div key={grupo[0].href}>
            {indice > 0 && (
              <hr
                role="separator"
                className="my-3 border-zinc-200"
              />
            )}
            <div className="flex flex-col gap-1">
              {grupo.map((item) => {
                const ativo =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={menuRecolhido && !movel ? item.rotulo : undefined}
                    aria-current={ativo ? "page" : undefined}
                    onClick={() => setMenuMovelAberto(false)}
                    className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors ${
                      ativo
                        ? "bg-[#002855] text-white shadow-sm"
                        : "text-zinc-700 hover:bg-blue-50 hover:text-[#002855]"
                    } ${menuRecolhido && !movel ? "justify-center px-2" : ""}`}
                  >
                    <IconeNavegacao href={item.href} />
                    {(!menuRecolhido || movel) && <span>{item.rotulo}</span>}
                    {ativo && (!menuRecolhido || movel) && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#ff5a1f]" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    );
  }

  return (
    <IndicadorCarregando>
      <div className="flex min-h-screen flex-col">
        <header className="relative z-30 border-b-2 border-[#ff5a1f] bg-[#002855] text-white shadow-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              onClick={alternarMenu}
              aria-label="Alternar menu de navegação"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <IconeMenu fechado={menuRecolhido && !menuMovelAberto} />
            </button>
            <div className="hidden min-w-0 flex-1 sm:block">
              <p className="truncate text-sm font-semibold tracking-wide">
                Gestão inteligente para o seu negócio
              </p>
            </div>

            {podeConsultarTransferencias && <NotificacoesTransferencia />}

            <details className="group relative ml-auto shrink-0">
              <summary
                aria-label="Abrir menu da conta"
                title={usuario.nome}
                className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-white/20 py-1 pl-1 pr-3 text-white transition-colors hover:bg-white/10 [&::-webkit-details-marker]:hidden"
              >
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/15 text-white">
                  {usuario.imagemUrl ? (
                    <Image
                      src={usuario.imagemUrl}
                      alt=""
                      width={32}
                      height={32}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <IconeUser className="h-4 w-4" />
                  )}
                </span>
                <span className="hidden max-w-40 truncate text-sm font-medium sm:block">
                  {usuario.nome}
                </span>
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="hidden h-4 w-4 sm:block"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 7.22a.75.75 0 0 1 1.06 0L10 10.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </summary>
              <div className="absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white p-1 text-zinc-900 shadow-xl">
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold">{usuario.nome}</p>
                  <p className="break-all text-xs text-zinc-600">
                    {usuario.email}
                  </p>
                </div>
                <hr className="my-1 border-zinc-200" />
                <Link
                  href={`/usuarios/${usuario.id}`}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                >
                  Minha conta
                </Link>
                <SeletorTema temaInicial={usuario.tema} />
                <hr className="my-1 border-zinc-200" />
                <form action={sair}>
                  <button
                    type="submit"
                    className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-zinc-800 hover:bg-zinc-100"
                  >
                    Sair
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>

        <div className="relative flex flex-1">
          <aside
            aria-label="Menu lateral"
            className={`hidden shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 lg:flex ${
              menuRecolhido ? "w-[4.5rem]" : "w-64"
            }`}
          >
            <div
              className={`flex h-24 items-center border-b border-zinc-100 px-5 ${
                menuRecolhido ? "justify-center px-2" : ""
              }`}
            >
              <Link href="/" aria-label="Atria - página inicial" className="block">
                {menuRecolhido ? (
                  <span className="relative block h-10 w-10">
                    <Image
                      src="/imagens/logo_atria_favicon.png"
                      alt="Atria"
                      fill
                      sizes="40px"
                      className="logo-atria-claro object-contain"
                    />
                    <Image
                      src="/imagens/logo_atria_favicon_branco.png"
                      alt=""
                      fill
                      sizes="40px"
                      className="logo-atria-escuro object-contain"
                    />
                  </span>
                ) : (
                  <span className="relative block h-14 w-52">
                    <Image
                      src="/imagens/logo_atria_colorido.png"
                      alt="Atria"
                      fill
                      sizes="208px"
                      className="logo-atria-claro object-contain object-left"
                      priority
                    />
                    <Image
                      src="/imagens/logo_atria_branco.png"
                      alt=""
                      fill
                      sizes="208px"
                      className="logo-atria-escuro object-contain object-left"
                      priority
                    />
                  </span>
                )}
              </Link>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              {!menuRecolhido && (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                  Menu principal
                </p>
              )}
              {renderizarNavegacao()}
            </div>
            {!menuRecolhido && (
              <div className="border-t border-zinc-100 px-5 py-3">
                <p className="text-xs font-medium text-zinc-400">
                  Atria · Gestão empresarial
                </p>
              </div>
            )}
          </aside>

          {menuMovelAberto && (
            <div className="fixed inset-0 top-16 z-40 lg:hidden">
              <button
                type="button"
                aria-label="Fechar menu"
                onClick={() => setMenuMovelAberto(false)}
                className="absolute inset-0 h-full w-full bg-zinc-950/50"
              />
              <aside
                aria-label="Menu lateral"
                className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-zinc-200 bg-white shadow-xl"
              >
                <div className="flex h-24 items-center border-b border-zinc-100 px-5">
                  <Link
                    href="/"
                    aria-label="Atria - página inicial"
                    onClick={() => setMenuMovelAberto(false)}
                    className="relative block h-14 w-52"
                  >
                    <Image
                      src="/imagens/logo_atria_colorido.png"
                      alt="Atria"
                      fill
                      sizes="208px"
                      className="logo-atria-claro object-contain object-left"
                    />
                    <Image
                      src="/imagens/logo_atria_branco.png"
                      alt=""
                      fill
                      sizes="208px"
                      className="logo-atria-escuro object-contain object-left"
                    />
                  </Link>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-4">
                  <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    Menu principal
                  </p>
                  {renderizarNavegacao(true)}
                </div>
                <div className="border-t border-zinc-100 px-5 py-3">
                  <p className="text-xs font-medium text-zinc-400">
                    Atria · Gestão empresarial
                  </p>
                </div>
              </aside>
            </div>
          )}

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </div>
    </IndicadorCarregando>
  );
}
