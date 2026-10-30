// ============================================================
// Seed da etapa 1: cadastra os 3 locais de estoque (seção 3 das regras),
// sincroniza o catálogo de permissões e concede TODAS as permissões
// ao primeiro usuário cadastrado (o administrador inicial).
// Rodar com: npm run db:seed
// Pode ser executado várias vezes: não duplica nada (usa upsert).
// ============================================================

import "dotenv/config"; // IMPORTANTE: precisa ser o primeiro import (carrega o .env)
import prisma from "../src/lib/prisma";
import { sincronizarCatalogoDePermissoes } from "../src/lib/permissoes";

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

  // Sincroniza o catálogo: grava/atualiza cada permissão do código
  // no banco (as novas nascem negadas)
  await sincronizarCatalogoDePermissoes();

  const permissoes = await prisma.permissao.findMany({
    orderBy: { ordem: "asc" },
    select: { id: true, codigo: true },
  });
  console.log(`\nPermissões no catálogo: ${permissoes.length}`);

  // Concede TODAS as permissões ao primeiro usuário cadastrado,
  // para que exista um administrador inicial. Depois disso, as
  // concessões são gerenciadas na tela /permissoes.
  const primeiroUsuario = await prisma.usuario.findFirst({
    orderBy: { id: "asc" },
    select: { id: true, nome: true, email: true },
  });

  if (!primeiroUsuario) {
    console.log(
      "\nNenhum usuário cadastrado ainda. Cadastre um usuário em /usuarios/novo" +
        " e rode o seed de novo para ele virar o administrador inicial."
    );
  } else {
    await prisma.permissaoUsuario.createMany({
      data: permissoes.map((permissao) => ({
        usuarioId: primeiroUsuario.id,
        permissaoId: permissao.id,
      })),
      skipDuplicates: true,
    });

    console.log(
      `\nTodas as permissões concedidas ao administrador inicial: ` +
        `"${primeiroUsuario.nome}" (${primeiroUsuario.email}).`
    );
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
