import { Prisma } from "@/generated/prisma/client";

export type SituacaoReposicao =
  | "CRITICO"
  | "COMPRAR"
  | "ADEQUADO";

export type IndicadoresReposicao = {
  quantidadeACaminho: Prisma.Decimal;
  posicaoEstoque: Prisma.Decimal;
  pontoReposicao: Prisma.Decimal | null;
  quantidadeSugerida: Prisma.Decimal;
  situacao: SituacaoReposicao;
};

export function calcularQuantidadeACaminho(
  itensEnviados: {
    quantidade: Prisma.Decimal;
    quantidadeRecebida: Prisma.Decimal;
  }[]
): Prisma.Decimal {
  return itensEnviados.reduce((total, item) => {
    const pendente = item.quantidade.sub(item.quantidadeRecebida);
    return total.add(Prisma.Decimal.max(pendente, 0));
  }, new Prisma.Decimal(0));
}

export function calcularIndicadoresReposicao({
  estoqueDisponivel,
  itensEnviados,
  consumoDiario,
  estoqueSeguranca,
  estoqueMaximoDesejado,
  prazoEntregaDias,
}: {
  estoqueDisponivel: Prisma.Decimal;
  itensEnviados: {
    quantidade: Prisma.Decimal;
    quantidadeRecebida: Prisma.Decimal;
  }[];
  consumoDiario: Prisma.Decimal;
  estoqueSeguranca: Prisma.Decimal;
  estoqueMaximoDesejado: Prisma.Decimal;
  prazoEntregaDias: number | null;
}): IndicadoresReposicao {
  const quantidadeACaminho = calcularQuantidadeACaminho(itensEnviados);
  const posicaoEstoque = estoqueDisponivel.add(quantidadeACaminho);
  const pontoReposicao =
    prazoEntregaDias === null
      ? null
      : consumoDiario.mul(prazoEntregaDias).add(estoqueSeguranca);
  const quantidadeSugerida = Prisma.Decimal.max(
    estoqueMaximoDesejado.sub(posicaoEstoque),
    0
  );
  const situacao: SituacaoReposicao =
    estoqueDisponivel.lte(estoqueSeguranca)
      ? "CRITICO"
      : pontoReposicao !== null && posicaoEstoque.lte(pontoReposicao)
        ? "COMPRAR"
        : "ADEQUADO";

  return {
    quantidadeACaminho,
    posicaoEstoque,
    pontoReposicao,
    quantidadeSugerida,
    situacao,
  };
}
