/* Configuração compartilhada (index.html e login.html).
   Porta vem do .http do back. A página PRECISA ser servida em http://localhost:5173
   (única origem liberada no CORS da API), não abrindo o arquivo direto. */
const CONFIG = {
  API_URL: "http://localhost:5122",
  TOKEN_KEY: "kgb_token",
  REFRESH_MS: 30_000,   // o contrato manda consultar /api/resumo a cada 30 s
  PAGINAS: { login: "login.html", novoPedido: "novo-pedido.html" },
};