import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import {
  COOKIE_GOOGLE_NONCE,
  COOKIE_GOOGLE_STATE,
  COOKIE_GOOGLE_VERIFIER,
  compararSegredos,
  criarClienteGoogleOAuth,
  obterConfiguracaoGoogleOAuth,
  obterOrigemAplicacao,
} from "@/lib/google-oauth";
import { criarSessao } from "@/lib/sessao";

function voltarParaLogin(
  origem: string,
  resultado: "cancelado" | "falha" | "nao-autorizado"
): NextResponse {
  return NextResponse.redirect(
    new URL(`/login?google=${resultado}`, origem)
  );
}

export async function GET(request: Request) {
  let origemLogin = obterOrigemAplicacao()?.origin;

  try {
    const configuracao = obterConfiguracaoGoogleOAuth();
    origemLogin = configuracao.appUrl.origin;

    const urlRequisicao = new URL(request.url);
    const cookieStore = await cookies();
    const stateEsperado = cookieStore.get(COOKIE_GOOGLE_STATE)?.value;
    const nonceEsperado = cookieStore.get(COOKIE_GOOGLE_NONCE)?.value;
    const verifier = cookieStore.get(COOKIE_GOOGLE_VERIFIER)?.value;

    cookieStore.delete(COOKIE_GOOGLE_STATE);
    cookieStore.delete(COOKIE_GOOGLE_NONCE);
    cookieStore.delete(COOKIE_GOOGLE_VERIFIER);

    const stateRecebido = urlRequisicao.searchParams.get("state") ?? undefined;
    if (!compararSegredos(stateEsperado, stateRecebido)) {
      return voltarParaLogin(origemLogin, "falha");
    }

    if (urlRequisicao.searchParams.has("error")) {
      return voltarParaLogin(origemLogin, "cancelado");
    }

    const codigo = urlRequisicao.searchParams.get("code");
    if (!nonceEsperado || !verifier || !codigo) {
      return voltarParaLogin(origemLogin, "falha");
    }

    const cliente = criarClienteGoogleOAuth(configuracao);
    const { tokens } = await cliente.getToken({
      code: codigo,
      codeVerifier: verifier,
      redirect_uri: configuracao.redirectUri,
    });
    if (!tokens.id_token) {
      return voltarParaLogin(origemLogin, "falha");
    }

    const ticket = await cliente.verifyIdToken({
      idToken: tokens.id_token,
      audience: configuracao.clientId,
    });
    const payload = ticket.getPayload();
    if (
      !payload ||
      (payload.iss !== "accounts.google.com" &&
        payload.iss !== "https://accounts.google.com") ||
      !compararSegredos(nonceEsperado, payload.nonce) ||
      payload.email_verified !== true ||
      !payload.email
    ) {
      return voltarParaLogin(origemLogin, "nao-autorizado");
    }

    const email = payload.email.trim().toLowerCase();
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true, ativo: true },
    });

    if (!usuario || !usuario.ativo) {
      return voltarParaLogin(origemLogin, "nao-autorizado");
    }

    await criarSessao(usuario.id);
    return NextResponse.redirect(new URL("/dashboard", origemLogin));
  } catch (erro) {
    console.error("Falha ao concluir o login com Google:", erro);
    if (!origemLogin) {
      return new Response("Login Google indisponível. Configure APP_URL.", {
        status: 503,
      });
    }
    return voltarParaLogin(origemLogin, "falha");
  }
}
