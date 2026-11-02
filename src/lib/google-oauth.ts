import "server-only";

import { OAuth2Client } from "google-auth-library";

export const COOKIE_GOOGLE_STATE = "google_oauth_state";
export const COOKIE_GOOGLE_NONCE = "google_oauth_nonce";
export const COOKIE_GOOGLE_VERIFIER = "google_oauth_verifier";

export type ConfiguracaoGoogleOAuth = {
  clientId: string;
  clientSecret: string;
  appUrl: URL;
  redirectUri: string;
};

export function obterOrigemAplicacao(): URL | null {
  const appUrlInformada =
    process.env.APP_URL?.trim() ||
    (process.env.NODE_ENV === "production"
      ? ""
      : "http://localhost:3000");

  if (!appUrlInformada) return null;

  let appUrl: URL;
  try {
    appUrl = new URL(appUrlInformada);
  } catch {
    return null;
  }

  if (
    (appUrl.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && appUrl.protocol === "http:")) ||
    appUrl.username !== "" ||
    appUrl.password !== "" ||
    appUrl.pathname !== "/" ||
    appUrl.search !== "" ||
    appUrl.hash !== ""
  ) {
    return null;
  }

  return appUrl;
}

export function obterConfiguracaoGoogleOAuth(): ConfiguracaoGoogleOAuth {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const appUrl = obterOrigemAplicacao();

  if (!clientId || !clientSecret || !appUrl) {
    throw new Error(
      "Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e uma APP_URL válida; em produção, use HTTPS."
    );
  }

  const redirectUri = new URL(
    "/api/auth/google/callback",
    appUrl.origin
  ).toString();

  return { clientId, clientSecret, appUrl, redirectUri };
}

export function criarClienteGoogleOAuth(
  configuracao: ConfiguracaoGoogleOAuth
): OAuth2Client {
  return new OAuth2Client(
    configuracao.clientId,
    configuracao.clientSecret,
    configuracao.redirectUri
  );
}

export function compararSegredos(
  esperado: string | undefined,
  recebido: string | undefined
): boolean {
  if (!esperado || !recebido) return false;
  if (esperado.length !== recebido.length) return false;

  let diferenca = 0;
  for (let indice = 0; indice < esperado.length; indice += 1) {
    diferenca |= esperado.charCodeAt(indice) ^ recebido.charCodeAt(indice);
  }
  return diferenca === 0;
}
