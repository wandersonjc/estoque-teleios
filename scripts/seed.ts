// ============================================================
// Seed da etapa 1: cadastra os 3 locais de estoque (seção 3 das regras)
// e serve de TESTE da conexão com o banco.
// Rodar com: npm run db:seed
// Pode ser executado várias vezes: não duplica nada (usa upsert).
// ============================================================

import "dotenv/config"; // IMPORTANTE: precisa ser o primeiro import (carrega o .env)
import prisma from "../src/lib/prisma";

const LOCAIS_DE_ESTOQUE = ["Loja Nova Iguaçu", "Loja Mesquita", "Galpão"];

async function main() {
  console.log("Conectando ao banco e cadastrando os locais de estoque...\n");

  for (const nome of LOCAIS_DE_ESTOQUE) {
    // upsert = cria se não existir; se já existir, não altera nada
    await prisma.localEstoque.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }

  // Lê de volta do banco para confirmar que gravou
  const locais = await prisma.localEstoque.findMany({
    orderBy: { id: "asc" },
  });

  console.log(`Locais cadastrados (${locais.length}):`);
  for (const local of locais) {
    console.log(`  - [${local.id}] ${local.nome}`);
  }

  console.log("\nTudo certo: a conexão com o banco está funcionando.");
}

main()
  .catch((erro) => {
    console.error("\nErro ao rodar o seed:", erro);
    process.exit(1);
  })
  .finally(async () => {
    // Fecha a conexão para o script terminar
    await prisma.$disconnect();
  });
