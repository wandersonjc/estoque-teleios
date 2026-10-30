"use server";

// ============================================================
// Módulo 1 - Usuários: ações do servidor
// Cadastrar, alterar e desativar/reativar usuários.
// A senha é sempre guardada como hash (nunca em texto puro) e
// nunca aparece no log. O usuário nunca é excluído: só fica
// inativo, para não quebrar movimentações e logs já gravados.
// Regras: docs/regras-de-negocio.md (seção 2)
// ============================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { registrarLog } from "@/lib/log";
import prisma from "@/lib/prisma";
import { gerarHashSenha } from "@/lib/senha";

import {
  LIMITE_EMAIL,
  LIMITE_NOME_USUARIO,
  PERFIS,
  SENHA_MINIMA,
  type ErrosFormularioUsuario,
  type EstadoFormularioUsuario,
  type Perfil,
  type ValoresFormularioUsuario,
} from "./tipos";

// ------------------------------------------------------------
// Funções auxiliares (não exportadas: em "use server" só podem
// ser exportadas funções assíncronas)
// ------------------------------------------------------------

// Lê os campos do formulário. Tudo chega como texto.
// A senha NÃO é aparada: espaço em branco pode fazer parte dela.
function lerValores(formData: FormData): ValoresFormularioUsuario {
  const texto = (campo: string): string => {
    const valor = formData.get(campo);
    return typeof valor === "string" ? valor.trim() : "";
  };

  const senha = formData.get("senha");

  return {
    nome: texto("nome"),
    // E-mail sempre em minúsculas, para a unicidade não depender do caso
    email: texto("email").toLowerCase(),
    perfil: texto("perfil").toUpperCase(),
    senha: typeof senha === "string" ? senha : "",
  };
}

// Validação simples de e-mail (não é exaustiva, só evita erros comuns)
const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type UsuarioValidado = {
  nome: string;
  email: string;
  perfil: Perfil;
  senha: string;
};

type ResultadoValidacao =
  | { ok: true; dados: UsuarioValidado }
  | { ok: false; estado: EstadoFormularioUsuario };

// "exigirSenha" é true no cadastro e false na edição (na edição,
// o campo em branco significa "manter a senha atual").
function validarUsuario(
  valores: ValoresFormularioUsuario,
  exigirSenha: boolean
): ResultadoValidacao {
  const erros: ErrosFormularioUsuario = {};

  if (valores.nome === "") {
    erros.nome = "Informe o nome do usuário.";
  } else if (valores.nome.length > LIMITE_NOME_USUARIO) {
    erros.nome = `O nome pode ter no máximo ${LIMITE_NOME_USUARIO} caracteres.`;
  }

  if (valores.email === "") {
    erros.email = "Informe o e-mail do usuário.";
  } else if (valores.email.length > LIMITE_EMAIL) {
    erros.email = `O e-mail pode ter no máximo ${LIMITE_EMAIL} caracteres.`;
  } else if (!FORMATO_EMAIL.test(valores.email)) {
    erros.email = "Informe um e-mail válido (ex.: nome@empresa.com.br).";
  }

  if (!PERFIS.includes(valores.perfil as Perfil)) {
    erros.perfil = "Escolha um perfil válido.";
  }

  if (exigirSenha && valores.senha === "") {
    erros.senha = "Informe a senha.";
  } else if (valores.senha !== "" && valores.senha.length < SENHA_MINIMA) {
    erros.senha = `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`;
  }

  if (Object.keys(erros).length > 0) {
    return { ok: false, estado: { erros, valores } };
  }

  return {
    ok: true,
    dados: {
      nome: valores.nome,
      email: valores.email,
      perfil: valores.perfil as Perfil,
      senha: valores.senha,
    },
  };
}

// P2002 = e-mail já cadastrado (a coluna "email" é única)
function tratarErroBanco(erro: unknown): string {
  if (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  ) {
    return "Já existe um usuário com este e-mail.";
  }

  console.error("Erro ao gravar usuário:", erro);
  return "Não foi possível salvar o usuário. Tente novamente.";
}

// ------------------------------------------------------------
// Ações
// ------------------------------------------------------------

export async function criarUsuario(
  _estadoAnterior: EstadoFormularioUsuario,
  formData: FormData
): Promise<EstadoFormularioUsuario> {
  const valores = lerValores(formData);
  const validacao = validarUsuario(valores, true);

  if (!validacao.ok) return validacao.estado;

  try {
    await prisma.$transaction(async (tx) => {
      const usuario = await tx.usuario.create({
        data: {
          nome: validacao.dados.nome,
          email: validacao.dados.email,
          senhaHash: gerarHashSenha(validacao.dados.senha),
          perfil: validacao.dados.perfil,
        },
      });

      // O log guarda os dados do usuário, NUNCA a senha
      await registrarLog(
        {
          modulo: "USUARIOS",
          acao: "CRIAR",
          registroId: usuario.id,
          descricao: `Usuário "${usuario.nome}" (${usuario.email}) cadastrado`,
          dados: {
            nome: usuario.nome,
            email: usuario.email,
            perfil: usuario.perfil,
          },
        },
        tx
      );
    });
  } catch (erro) {
    return { erroGeral: tratarErroBanco(erro), valores };
  }

  // Fora do try/catch: o redirect lança um erro de controle de fluxo
  revalidatePath("/usuarios");
  redirect("/usuarios");
}

// Altera nome, e-mail e perfil. A senha só muda se o campo vier
// preenchido (em branco = mantém a atual).
export async function atualizarUsuario(
  _estadoAnterior: EstadoFormularioUsuario,
  formData: FormData
): Promise<EstadoFormularioUsuario> {
  const valores = lerValores(formData);
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return { erroGeral: "Usuário inválido.", valores };
  }

  const validacao = validarUsuario(valores, false);
  if (!validacao.ok) return validacao.estado;

  const antes = await prisma.usuario.findUnique({
    where: { id },
    select: { nome: true, email: true, perfil: true },
  });
  if (!antes) return { erroGeral: "Usuário não encontrado.", valores };

  const senhaAlterada = validacao.dados.senha !== "";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.usuario.update({
        where: { id },
        data: {
          nome: validacao.dados.nome,
          email: validacao.dados.email,
          perfil: validacao.dados.perfil,
          // Só troca a senha quando uma nova foi digitada
          ...(senhaAlterada
            ? { senhaHash: gerarHashSenha(validacao.dados.senha) }
            : {}),
        },
      });

      await registrarLog(
        {
          modulo: "USUARIOS",
          acao: "ALTERAR",
          registroId: id,
          descricao: `Usuário "${validacao.dados.nome}" (${validacao.dados.email}) alterado`,
          dados: {
            antes: { nome: antes.nome, email: antes.email, perfil: antes.perfil },
            depois: {
              nome: validacao.dados.nome,
              email: validacao.dados.email,
              perfil: validacao.dados.perfil,
            },
            senhaAlterada,
          },
        },
        tx
      );
    });
  } catch (erro) {
    return { erroGeral: tratarErroBanco(erro), valores };
  }

  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${id}`);
  redirect(`/usuarios/${id}?salvo=1`);
}

// O usuário nunca é apagado: só desativado, para não quebrar as
// movimentações e os logs que apontam para ele.
export async function desativarUsuario(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: { nome: true },
  });
  if (!usuario) return;

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id }, data: { ativo: false } });

    await registrarLog(
      {
        modulo: "USUARIOS",
        acao: "ALTERAR",
        registroId: id,
        descricao: `Usuário "${usuario.nome}" desativado`,
      },
      tx
    );
  });

  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${id}`);
}

export async function reativarUsuario(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: { nome: true },
  });
  if (!usuario) return;

  await prisma.$transaction(async (tx) => {
    await tx.usuario.update({ where: { id }, data: { ativo: true } });

    await registrarLog(
      {
        modulo: "USUARIOS",
        acao: "ALTERAR",
        registroId: id,
        descricao: `Usuário "${usuario.nome}" reativado`,
      },
      tx
    );
  });

  revalidatePath("/usuarios");
  revalidatePath(`/usuarios/${id}`);
}

// Só exclui usuário que não tem nenhuma movimentação nem log: o
// histórico nunca é apagado por causa de um cadastro. Nos demais
// casos, o usuário só pode ser desativado.
export async function excluirUsuario(formData: FormData): Promise<void> {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;

  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: { nome: true, email: true },
  });
  if (!usuario) return;

  const movimentos = await prisma.movimentoEstoque.count({
    where: { usuarioId: id },
  });
  const logs = await prisma.logSistema.count({ where: { usuarioId: id } });

  if (movimentos > 0 || logs > 0) {
    redirect(`/usuarios/${id}?erro=em-uso`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.usuario.delete({ where: { id } });

    await registrarLog(
      {
        modulo: "USUARIOS",
        acao: "EXCLUIR",
        registroId: id,
        descricao: `Usuário "${usuario.nome}" (${usuario.email}) excluído`,
        dados: { nome: usuario.nome, email: usuario.email },
      },
      tx
    );
  });

  revalidatePath("/usuarios");
  redirect("/usuarios");
}
