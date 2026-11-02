import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { CodeChallengeMethod } from "google-auth-library";

import {
  COOKIE_GOOGLE_NONCE,
  COOKIE_GOOGLE_STATE,
  COOKIE_GOOGLE_VERIFIER,
  criarClienteGoogleOAuth,
  obterConfiguracaoGoogleOAuth,
  obterOrigemAplicacao,
} from "@/lib/google-oauth";

const DURACAO_FLUXO_SEGUNDOS = 10 * 60;

export async function GET() {
  try {
    const configuracao = obterConfiguracaoGoogleOAuth();
    const cliente = criarClienteGoogleOAuth(configuracao);
    const [state, nonce, verifier] = await Promise.all([
      randomBytes(32).toString("base64url"),
      randomBytes(32).toString("base64url"),
      cliente.generateCodeVerifierAsync(),
    ]);
    if (!verifier.codeChallenge) {
      throw new Error("Não foi possível gerar o desafio PKCE.");
    }

    const cookieStore = await cookies();
    const opcoesCookie = {
      httpOnly: true,
      secure: configuracao.appUrl.protocol === "https:",
      sameSite: "lax" as const,
      maxAge: DURACAO_FLUXO_SEGUNDOS,
      path: "/",
    };

    cookieStore.set(COOKIE_GOOGLE_STATE, state, opcoesCookie);
    cookieStore.set(COOKIE_GOOGLE_NONCE, nonce, opcoesCookie);
    cookieStore.set(COOKIE_GOOGLE_VERIFIER, verifier.codeVerifier, opcoesCookie);

    const urlAutorizacao = cliente.generateAuthUrl({
      access_type: "online",
      code_challenge: verifier.codeChallenge,
      code_challenge_method: CodeChallengeMethod.S256,
      include_granted_scopes: false,
      nonce,
      prompt: "select_account",
      redirect_uri: configuracao.redirectUri,
      response_type: "code",
      scope: ["openid", "email"],
      state,
    });

    return NextResponse.redirect(urlAutorizacao);
  } catch (erro) {
    console.error("Não foi possível iniciar o login com Google:", erro);
    const origem = obterOrigemAplicacao();
    if (!origem) {
      return new Response("Login Google indisponível. Configure APP_URL.", {
        status: 503,
      });
    }
    return NextResponse.redirect(
      new URL("/login?google=configuracao", origem)
    );
  }
}
