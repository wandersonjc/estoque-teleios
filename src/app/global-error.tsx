"use client";

import ErroAplicacao from "@/components/ErroAplicacao";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <ErroAplicacao erro={error} tentarNovamente={reset} />
      </body>
    </html>
  );
}
