"use client";

import ErroAplicacao from "@/components/ErroAplicacao";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErroAplicacao erro={error} tentarNovamente={reset} />;
}
