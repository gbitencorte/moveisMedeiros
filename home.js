/* Configuração em config.js. Contrato da API: CONTRATO_API.md.
   Abra home.html?demo para pré-visualizar a tela com usuário e pedidos
   (dados em EXEMPLO_FUTURO, que ficam guardados e não aparecem por padrão). */
const MODO_DEMO = new URLSearchParams(location.search).has("demo");


/* ---------- Ícones ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M9 12h6M9 16h4"/>',
  alert: '<path d="M10.3 4 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17.5v.01"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  pin: '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  calendar: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5a5 5 0 0 1 4.5 5.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  box: '<path d="m3 7.5 9-4.5 9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
const hydrateIcons = (root = document) =>
  root.querySelectorAll("[data-icon]:empty").forEach((el) => (el.innerHTML = icon(el.dataset.icon)));

/* ---------- Utilidades ---------- */
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s = "") => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const pad = (n) => String(n).padStart(2, "0");
const iniciais = (nome = "") => nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
const mesmoDia = (a, b) => a.toDateString() === b.toDateString();

function formatarPrazo(obra) {
  if (obra.status === "concluido" && obra.concluidoEm) {
    const d = new Date(obra.concluidoEm + "T00:00:00");
    return { texto: `Concluído em ${d.getDate()} ${MESES[d.getMonth()]}`, urgente: false };
  }
  if (obra.status === "concluido") return { texto: "Concluído", urgente: false };
  if (!obra.prazo) return { texto: "Sem prazo", urgente: false };
  const d = new Date(obra.prazo), hoje = new Date(), amanha = new Date();
  amanha.setDate(hoje.getDate() + 1);
  const hora = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (mesmoDia(d, hoje)) return { texto: `Hoje, ${hora}`, urgente: true };
  if (mesmoDia(d, amanha)) return { texto: `Amanhã, ${hora}`, urgente: false };
  return { texto: `${d.getDate()} ${MESES[d.getMonth()]}, ${hora}`, urgente: d < hoje };
}

const STATUS = {
  execucao: { rotulo: "Em execução", classe: "badge-execucao" },
  pendente: { rotulo: "Pendente", classe: "badge-pendente" },
  concluido: { rotulo: "Concluído", classe: "badge-concluido" },
};

/* ---------- Dados ---------- */

/* Guardado para o futuro: é assim que a tela ficará quando a pessoa
   estiver cadastrada e tiver feito pedidos. Só aparece com ?demo. */
function EXEMPLO_FUTURO() {
  const em = (dias, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + dias); d.setHours(h, m, 0, 0); return d.toISOString(); };
  return {
    usuario: { nome: "Rafael Medeiros", cargo: "Líder / Inspetor", papel: "LIDER" },
    resumo: { total: 12, inspecoes: 3, ncs: 5 },
    obras: [
      { id: "MM-0248", nome: "Residência Andrade", cliente: "Carolina Andrade", local: "Jardim Europa · São Paulo", status: "execucao", etapa: "Montagem", progresso: 72, ncs: 2, prazo: em(0, 18) },
      { id: "MM-0247", nome: "Apartamento Pinheiros", cliente: "Lucas Martins", local: "Pinheiros · São Paulo", status: "execucao", etapa: "Acabamento", progresso: 90, ncs: 0, prazo: em(1, 16) },
      { id: "MM-0246", nome: "Clínica Aurora", cliente: "Dra. Ana Ribeiro", local: "Moema · São Paulo", status: "pendente", etapa: "Instalação", progresso: 45, ncs: 1, prazo: em(3, 12) },
      { id: "MM-0245", nome: "Escritório Vértice", cliente: "Vértice Arquitetura", local: "Vila Olímpia · São Paulo", status: "concluido", etapa: "Finalizado", progresso: 100, ncs: 0, concluidoEm: "2026-05-22" },
    ],
  };
}

const DADOS_VAZIOS = { usuario: null, resumo: { total: 0, inspecoes: 0, ncs: 0 }, obras: [] };

const ETAPAS = { MEDIDA: "Medida", PROJETO: "Projeto", MATERIAL: "Material", MONTAGEM: "Montagem", INSTALACAO: "Instalação", ACABAMENTO: "Acabamento" };
const CARGOS = { LIDER: "Líder / Inspetor", MONTADOR: "Montador", AUXILIAR: "Auxiliar" };
const STATUS_API = { PENDENTE: "pendente", EM_EXECUCAO: "execucao", CONCLUIDO: "concluido" };
const getToken = () => localStorage.getItem(CONFIG.TOKEN_KEY) || sessionStorage.getItem(CONFIG.TOKEN_KEY);
const sair = () => {
  localStorage.removeItem(CONFIG.TOKEN_KEY);
  sessionStorage.removeItem(CONFIG.TOKEN_KEY);
};
const irParaLogin = () => location.replace(CONFIG.PAGINAS.login); // o sistema é interno: não há página para visitante

async function api(caminho) {
  const res = await fetch(CONFIG.API_URL + caminho, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (res.ok) return res.json();
  const problema = await res.json().catch(() => ({}));
  throw Object.assign(new Error(problema.code ?? `HTTP ${res.status}`), { status: res.status, code: problema.code });
}

// PedidoResumoDto → modelo da tela (rótulos são traduzidos aqui; a API não os envia)
const adaptarPedido = (p) => {
  const status = STATUS_API[p.status] ?? "pendente";
  return {
    pid: p.id, id: p.numero, nome: p.nomeObra, cliente: p.cliente.nome, local: p.endereco,
    status, etapa: status === "concluido" ? "Finalizado" : ETAPAS[p.etapaAtual] ?? p.etapaAtual,
    progresso: p.progressoPercentual, ncs: p.totalNcAbertas, prazo: p.prazo,
  };
};

async function carregarDados() {
  if (MODO_DEMO) return EXEMPLO_FUTURO();
  if (!getToken()) { irParaLogin(); return DADOS_VAZIOS; }
  try {
    const [me, resumo, pedidos] = await Promise.all([
      api("/api/auth/me"), api("/api/resumo"), api("/api/pedidos?page=1&pageSize=100"),
    ]);
    return {
      usuario: { nome: me.nome, cargo: CARGOS[me.cargo] ?? me.cargo, papel: me.cargo },
      resumo: { total: pedidos.totalItems, inspecoes: resumo.inspecoesPendentes, ncs: resumo.ncAbertas },
      obras: pedidos.items.map(adaptarPedido),
    };
  } catch (e) {
    if (e.code === "NAO_AUTENTICADO") { sair(); irParaLogin(); return DADOS_VAZIOS; } // token expirado → volta ao login
    throw e;
  }
}

/* ---------- Estado ---------- */
const state = { obras: [], resumo: {}, usuario: null, filtro: "todas", busca: "", carregando: true, erro: false };

const FILTROS = {
  todas: () => true,
  montagem: (o) => o.status !== "concluido" && norm(o.etapa) === "montagem",
  instalacao: (o) => o.status !== "concluido" && norm(o.etapa) === "instalacao",
  acabamento: (o) => o.status !== "concluido" && norm(o.etapa) === "acabamento",
  concluidas: (o) => o.status === "concluido",
};

const visiveis = () => {
  const termo = norm(state.busca.trim());
  return state.obras.filter(FILTROS[state.filtro]).filter((o) =>
    !termo || norm([o.nome, o.cliente, o.id, o.local].join(" ")).includes(termo));
};

/* ---------- Renderização ---------- */
const $ = (id) => document.getElementById(id);

function cardHTML(o) {
  const st = STATUS[o.status] ?? STATUS.pendente;
  const prazo = formatarPrazo(o);
  const pct = Math.max(0, Math.min(100, Number(o.progresso) || 0));
  const nc = o.ncs > 0
    ? `<span class="nc-chip"><span data-icon="alert"></span>${o.ncs} ${o.ncs === 1 ? "NC" : "NCs"}</span>` : "";
  return `
    <a class="card" href="obra.html?id=${encodeURIComponent(o.pid ?? o.id)}">
      <div class="card-head">
        <span class="badge ${st.classe}">${st.rotulo}</span>
        <span class="pedido">#${esc(o.id)}</span>
      </div>
      <h3>${esc(o.nome)}</h3>
      <p class="cliente">${esc(o.cliente)}</p>
      <p class="local"><span data-icon="pin"></span>${esc(o.local)}</p>
      <div class="progress">
        <div class="progress-top"><span>${esc(o.etapa)}</span><b>${pct}%</b></div>
        <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
      </div>
      <div class="card-foot">
        <span class="prazo ${prazo.urgente ? "is-urgent" : ""}"><span data-icon="calendar"></span>${prazo.texto}</span>
        ${nc}
        <span class="go"><span data-icon="chevron"></span></span>
      </div>
    </a>`;
}

function vazioHTML() {
  const lider = state.usuario?.papel === "LIDER";
  const texto = lider
    ? "Quando você criar um pedido, a obra aparece aqui com etapa, prazo e inspeções."
    : "Você ainda não foi atribuído a nenhum pedido. Quando for, ele aparece aqui.";
  return `
    <div class="empty">
      <span class="empty-icon"><span data-icon="box"></span></span>
      <h3>Nenhum pedido por aqui ainda</h3>
      <p>${texto}</p>
      ${lider ? '<button class="btn-primary" type="button" id="emptyCriar"><span data-icon="plus"></span> Criar pedido</button>' : ""}
    </div>`;
}

function renderLista() {
  const lista = $("lista");
  if (state.carregando) { lista.innerHTML = '<div class="skeleton"></div>'.repeat(4); return; }
  if (state.erro) {
    const aviso = state.erro === "conexao"
      ? `Não foi possível conectar à API (${esc(CONFIG.API_URL)}).<br>Confira se ela está rodando e se a origem ${esc(location.origin)} está liberada no CORS.`
      : `Não foi possível carregar as obras (erro ${esc(String(state.erro))}).`;
    lista.innerHTML = `<div class="state">${aviso}<br><button type="button" id="retry">Tentar de novo</button></div>`;
    return;
  }
  if (!state.obras.length) { lista.innerHTML = vazioHTML(); hydrateIcons(lista); return; }

  const obras = visiveis();
  lista.innerHTML = obras.length
    ? obras.map(cardHTML).join("")
    : `<div class="state">${state.busca ? "Nenhuma obra encontrada para essa busca." : "Nenhuma obra nesta etapa por enquanto."}</div>`;
  hydrateIcons(lista);
}

function renderChrome() {
  const { usuario, resumo } = state;

  // Perfil, botão de criar pedido e Usuários só aparecem com a sessão carregada.
  if (usuario) {
    $("userName").textContent = usuario.nome;
    $("userRole").textContent = usuario.cargo ?? "";
    $("userAvatar").textContent = $("topAvatar").textContent = iniciais(usuario.nome);
  }
  $("btnUser").hidden = $("topAvatar").hidden = !usuario;
  $("navUsuarios").hidden = usuario?.papel !== "LIDER"; // gestão de usuários é do Líder
  $("btnCriar").hidden = usuario?.papel !== "LIDER";    // só o Líder cria pedidos

  // Contadores: só aparecem quando maiores que zero.
  const setCount = (id, n) => { const el = $(id); el.textContent = n; el.hidden = !(n > 0); };
  setCount("countInspecoes", resumo.inspecoes ?? 0);
  setCount("countNcs", resumo.ncs ?? 0);
  $("alertDot").hidden = !(resumo.ncs > 0);

  const total = resumo.total ?? state.obras.length;
  $("countTodas").textContent = total > 0 ? total : "";
}

/* ---------- Ações ---------- */
async function atualizar({ silencioso = false } = {}) {
  if (!silencioso) { state.carregando = true; state.erro = false; renderLista(); }
  try {
    const data = await carregarDados();
    Object.assign(state, { obras: data.obras ?? [], resumo: data.resumo ?? {}, usuario: data.usuario ?? null, erro: false });
  } catch (e) {
    console.error(e);
    if (!silencioso) state.erro = e instanceof TypeError ? "conexao" : (e.code ?? e.status ?? "desconhecido");
  } finally {
    state.carregando = false;
    renderChrome();
    renderLista();
  }
}

const criarPedido = () => { location.href = CONFIG.PAGINAS.novoPedido; };
const abrirPerfil = () => {
  if (!MODO_DEMO && confirm("Sair da conta?")) { sair(); irParaLogin(); }
};

/* ---------- Eventos ---------- */
$("tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  state.filtro = tab.dataset.filtro;
  document.querySelectorAll(".tab").forEach((t) => {
    const ativa = t === tab;
    t.classList.toggle("is-active", ativa);
    t.setAttribute("aria-selected", ativa);
  });
  renderLista();
});

let debounce;
$("busca").addEventListener("input", (e) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { state.busca = e.target.value; renderLista(); }, 150);
});

$("lista").addEventListener("click", (e) => {
  if (e.target.closest("#retry")) atualizar();
  if (e.target.closest("#emptyCriar")) criarPedido();
});
$("btnCriar").addEventListener("click", criarPedido);
$("btnUser").addEventListener("click", abrirPerfil);

/* ---------- Início ---------- */
hydrateIcons();
if (!MODO_DEMO && !getToken()) {
  irParaLogin();
} else {
  atualizar();
  if (CONFIG.API_URL && CONFIG.REFRESH_MS) {
    setInterval(() => !document.hidden && atualizar({ silencioso: true }), CONFIG.REFRESH_MS);
    document.addEventListener("visibilitychange", () => !document.hidden && atualizar({ silencioso: true }));
  }
}