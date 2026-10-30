// ============================================================
// Indicador de carregamento das telas (convenção "loading.tsx").
// O Next mostra esta tela na hora em que o usuário clica num link,
// enquanto a próxima página é montada no servidor; o conteúdo real
// substitui este aviso assim que fica pronto.
// ============================================================

import { IconeCarregando } from "@/components/icones";

export default function Carregando() {
  return (
    <main
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-4 py-16"
    >
      <span className="flex items-center gap-3 text-base text-zinc-600">
        <IconeCarregando className="h-6 w-6 animate-spin text-zinc-500" />
        Carregando...
      </span>
    </main>
  );
}
