self.addEventListener("push", (evento) => {
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch {
    dados = { body: evento.data?.text() ?? "" };
  }

  const url =
    typeof dados.url === "string" &&
    dados.url.startsWith("/transferencias/")
      ? dados.url
      : "/transferencias";

  evento.waitUntil(
    self.registration.showNotification(
      typeof dados.title === "string" ? dados.title : "Atria",
      {
        body:
          typeof dados.body === "string" && dados.body
            ? dados.body
            : "Você tem uma nova notificação de transferência.",
        icon: "/imagens/favicon/web-app-manifest-192x192.png",
        badge: "/imagens/favicon/favicon-96x96.png",
        tag:
          typeof dados.tag === "string" ? dados.tag : "notificacao-atria",
        data: { url },
      }
    )
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL(
    evento.notification.data?.url ?? "/transferencias",
    self.location.origin
  );
  const caminho =
    destino.origin === self.location.origin &&
    destino.pathname.startsWith("/transferencias/")
      ? `${destino.pathname}${destino.search}`
      : "/transferencias";

  evento.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientes) => {
        for (const cliente of clientes) {
          if (new URL(cliente.url).origin === self.location.origin) {
            return cliente.navigate(caminho).then((navegacao) =>
              (navegacao ?? cliente).focus()
            );
          }
        }
        return self.clients.openWindow(caminho);
      })
  );
});
