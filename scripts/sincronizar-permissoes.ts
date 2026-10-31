import "dotenv/config";

import prisma from "../src/lib/prisma";
import { sincronizarCatalogoDePermissoes } from "../src/lib/permissoes";

async function main() {
  await sincronizarCatalogoDePermissoes();
  console.log("Catálogo de permissões sincronizado.");
}

main()
  .catch((erro) => {
    console.error("Erro ao sincronizar o catálogo de permissões:", erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });