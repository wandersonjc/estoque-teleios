import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import AppShell from "@/components/AppShell";
import IndicadorCarregando from "@/components/IndicadorCarregando";
import { usuarioAtual } from "@/lib/autorizacao";
import { MENU_PRINCIPAL } from "@/lib/permissoes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const usuario = await usuarioAtual();
  const favicon =
    usuario?.tema === "ESCURO"
      ? "/imagens/logo_atria_favicon_branco.png"
      : "/imagens/logo_atria_favicon.png";

  return {
    title: "Atria",
    description: "Sistema de gestão Atria",
    icons: { icon: favicon },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // O menu é montado a partir das permissões do usuário logado.
  // Sem sessão (tela de login), nenhum link aparece.
  const usuario = await usuarioAtual();
  const tema = usuario?.tema === "ESCURO" ? "escuro" : "claro";
  const itensDoMenu = usuario
    ? MENU_PRINCIPAL.filter(
        (item) => !item.permissao || usuario.permissoes.has(item.permissao)
      )
    : [];

  return (
    <html
      lang="pt-BR"
      data-tema={tema}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {usuario ? (
          <AppShell
            itensDoMenu={itensDoMenu}
            usuario={{
              id: usuario.id,
              nome: usuario.nome,
              email: usuario.email,
              imagemUrl: usuario.imagemChave
                ? `/api/imagens/usuarios/${usuario.id}?v=${usuario.atualizadoEm.getTime()}`
                : undefined,
              tema,
            }}
          >
            {children}
          </AppShell>
        ) : (
          <IndicadorCarregando>{children}</IndicadorCarregando>
        )}
      </body>
    </html>
  );
}
