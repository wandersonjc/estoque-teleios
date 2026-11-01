// Migra os códigos de barras legados para a tabela de embalagens.
// Execute uma vez após `npx prisma db push`; pode ser repetido com segurança.

import "dotenv/config";
import prisma from "../src/lib/prisma";

async function main() {
  const produtos = await prisma.produto.findMany({
    where: { codigoBarras: { not: null } },
    select: {
      id: true,
      codigoBarras: true,
      unidade: true,
      embalagens: { select: { id: true }, take: 1 },
    },
    orderBy: { id: "asc" },
  });

  let migrados = 0;
  for (const produto of produtos) {
    if (!produto.codigoBarras?.trim() || produto.embalagens.length > 0) continue;

    await prisma.embalagemProduto.create({
      data: {
        produtoId: produto.id,
        codigoBarras: produto.codigoBarras,
        unidade: produto.unidade,
        quantidadeBase: "1",
        principal: true,
      },
    });
    migrados += 1;
  }

  console.log(`Códigos de barras migrados para embalagens: ${migrados}.`);
}

main()
  .catch((erro: unknown) => {
    console.error("Não foi possível migrar os códigos de barras legados:", erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
