export const MENSAGEM_BANCO_INDISPONIVEL =
  "O banco de dados está temporariamente indisponível. Tente novamente em alguns instantes.";

export class BancoIndisponivelError extends Error {
  constructor(causa: unknown) {
    super(MENSAGEM_BANCO_INDISPONIVEL, { cause: causa });
    this.name = "BancoIndisponivelError";
  }
}

export function ehBancoIndisponivel(erro: unknown): boolean {
  let atual: unknown = erro;

  for (let profundidade = 0; profundidade < 5 && atual; profundidade += 1) {
    if (atual instanceof BancoIndisponivelError) return true;

    if (typeof atual !== "object") return false;

    const registro = atual as {
      code?: unknown;
      errorCode?: unknown;
      kind?: unknown;
      message?: unknown;
      name?: unknown;
      cause?: unknown;
    };
    if (
      registro.name === "BancoIndisponivelError" ||
      registro.message === MENSAGEM_BANCO_INDISPONIVEL ||
      registro.code === "P1001" ||
      registro.code === "P1002" ||
      registro.errorCode === "P1001" ||
      registro.errorCode === "P1002" ||
      registro.kind === "DatabaseNotReachable" ||
      (typeof registro.message === "string" &&
        /can't reach database server|database not reachable/i.test(
          registro.message
        ))
    ) {
      return true;
    }

    atual = registro.cause;
  }

  return false;
}
