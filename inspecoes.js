/* =========================================================
 * Móveis Medeiros · Checklist de inspeção
 * Ajuste API_BASE_URL e o objeto ENDPOINTS conforme as rotas
 * reais da KGB_Moveis_Medeiros_Api.
 * ========================================================= */
const API_BASE_URL = "http://localhost:3000/api";
const OBRA_ID = new URLSearchParams(location.search).get("obra") || "1";
const USAR_MOCK_SE_API_FALHAR = true; // desligue em produção

const ENDPOINTS = {
  obra:        (id) => `/obras/${id}`,
  checklist:   (id) => `/obras/${id}/inspecao`,                 // GET -> { id, itens:[{id, titulo, resultado}] }
  resposta:    (insp, item) => `/inspecoes/${insp}/itens/${item}`, // PATCH { resultado: "OK"|"NOK"|"NA" }
  atividades:  (id) => `/obras/${id}/atividades`,
  ncCriar:     `/nao-conformidades`,                            // POST
  finalizar:   (insp) => `/inspecoes/${insp}/finalizar`,        // POST
};

const token = () => localStorage.getItem("token"); // se a API usa JWT

async function api(path, opts = {}) {
  const res = await fetch(API_BASE_URL + path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.status === 204 ? null : res.json();
}

/* ---------- Estado ---------- */
const state = { obra: null, inspecao: null, itens: [], atividades: [], offline: false };
let itemPendenteNc = null;

/* ---------- Dados de exemplo (fallback) ---------- */
const MOCK = {
  obra: { id: 1, pedido: "MM-0248", nome: "Residência Andrade", cliente: "Carolina Andrade",
          local: "Jardim Europa, São Paulo", status: "EM EXECUÇÃO", etapa: "Montagem",
          prazo: "Hoje, 18:00", inspetor: "Rafael Medeiros", progresso: 72,
          ncAbertas: 5, inspecoesPendentes: 3 },
  inspecao: { id: 10, itens: [
    { id: 1, titulo: "Alinhamento e nivelamento dos módulos", resultado: "OK" },
    { id: 2, titulo: "Fixação e estabilidade das estruturas", resultado: "OK" },
    { id: 3, titulo: "Ajuste de portas e gavetas", resultado: "NOK", naoConformidadeId: 1 },
    { id: 4, titulo: "Integridade do acabamento", resultado: null },
    { id: 5, titulo: "Limpeza e proteção do ambiente", resultado: null },
  ]},
  atividades: [
    { titulo: "Inspeção iniciada", autor: "Rafael Medeiros", quando: "Hoje, 14:32" },
    { titulo: "Montagem atualizada", autor: "Diego Alves", quando: "Hoje, 10:15" },
  ],
};

/* ---------- Helpers ---------- */
const $ = (id) => document.getElementById(id);
const iniciais = (n = "") => n.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2600);
}
function setSave(msg) { $("saveState").textContent = msg; }

/* ---------- Carregamento ---------- */
async function carregar() {
  try {
    const [obra, inspecao, atividades] = await Promise.all([
      api(ENDPOINTS.obra(OBRA_ID)),
      api(ENDPOINTS.checklist(OBRA_ID)),
      api(ENDPOINTS.atividades(OBRA_ID)).catch(() => []),
    ]);
    Object.assign(state, { obra, inspecao, itens: inspecao.itens, atividades });
  } catch (e) {
    if (!USAR_MOCK_SE_API_FALHAR) { setSave("Não foi possível carregar. Tente novamente."); return; }
    console.warn("API indisponível, usando dados de exemplo:", e.message);
    state.offline = true;
    state.obra = structuredClone(MOCK.obra);
    state.inspecao = structuredClone(MOCK.inspecao);
    state.itens = state.inspecao.itens;
    state.atividades = MOCK.atividades;
  }
  renderTudo();
  setSave(state.offline ? "Modo demonstração (API offline)" : "Salvo automaticamente agora");
}

/* ---------- Render ---------- */
function renderTudo() { renderObra(); renderItens(); renderProgresso(); renderAtividades(); }

function renderObra() {
  const o = state.obra;
  $("obraTitulo").textContent = $("heroTitulo").textContent = o.nome;
  $("obraPedido").textContent = `Pedido #${o.pedido}`;
  $("heroEndereco").textContent = `${o.cliente} · ${o.local}`;
  $("obraStatus").textContent = o.status;
  $("metaEtapa").textContent = o.etapa;
  $("metaPrazo").textContent = o.prazo;
  $("metaInspetor").textContent = o.inspetor;
  $("userName").textContent = o.inspetor;
  $("userAvatar").textContent = $("topAvatar").textContent = iniciais(o.inspetor);
  if (o.inspecoesPendentes != null) $("badgeInsp").textContent = o.inspecoesPendentes;
  if (o.ncAbertas != null) $("badgeNc").textContent = o.ncAbertas;
}

const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>';

function renderItens() {
  $("itens").innerHTML = state.itens.map((it, i) => {
    const btn = (valor, conteudo) =>
      `<button type="button" class="${valor.toLowerCase()} ${it.resultado === valor ? "on" : ""}"
         data-id="${it.id}" data-valor="${valor}" aria-pressed="${it.resultado === valor}">${conteudo}</button>`;
    return `<li class="item">
      <div class="item-label">
        <span class="n">${String(i + 1).padStart(2, "0")}</span>
        <span>${esc(it.titulo)}${it.resultado === "NOK" ? '<span class="nc-tag">NC aberta</span>' : ""}</span>
      </div>
      <div class="seg" role="group" aria-label="Resultado do item ${i + 1}">
        ${btn("OK", CHECK + "OK")}${btn("NOK", "NOK")}${btn("NA", "NA")}
      </div>
    </li>`;
  }).join("");
}

function renderProgresso() {
  const respondidos = state.itens.filter(i => i.resultado).length;
  $("contador").textContent = `${respondidos} de ${state.itens.length}`;
  const pct = state.obra.progresso ?? 0;
  $("progPct").textContent = pct + "%";
  $("progBar").style.width = pct + "%";
}

function renderAtividades() {
  $("atividades").innerHTML = state.atividades.map(a => `
    <li><i></i><div><b>${esc(a.titulo)}</b><span>Por ${esc(a.autor)}</span><time>${esc(a.quando)}</time></div></li>
  `).join("") || '<li><div><span>Nenhuma atividade ainda.</span></div></li>';
}

/* ---------- Responder item ---------- */
$("itens").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-id]");
  if (!b) return;
  const item = state.itens.find(i => String(i.id) === b.dataset.id);
  const valor = b.dataset.valor;
  if (item.resultado === valor) return;

  if (valor === "NOK") { abrirModalNc(item, true); return; } // NC é obrigatória
  await salvarResultado(item, valor);
});

async function salvarResultado(item, valor) {
  const anterior = item.resultado;
  item.resultado = valor;
  renderItens(); renderProgresso();
  setSave("Salvando…");
  try {
    if (!state.offline) await api(ENDPOINTS.resposta(state.inspecao.id, item.id), { method: "PATCH", body: { resultado: valor } });
    setSave(state.offline ? "Modo demonstração (API offline)" : "Salvo automaticamente agora");
  } catch (err) {
    item.resultado = anterior;
    renderItens(); renderProgresso();
    setSave("Falha ao salvar. Tente novamente.");
    toast("Não foi possível salvar o item.");
  }
}

/* ---------- Não conformidade ---------- */
function abrirModalNc(item, obrigatoria) {
  itemPendenteNc = item;
  $("modalItem").textContent = item
    ? `Item: ${item.titulo}`
    : "Descreva a não conformidade encontrada nesta obra.";
  $("ncDesc").value = ""; $("ncErr").hidden = true;
  $("modal").hidden = false; $("ncDesc").focus();
  $("ncSave").dataset.obrigatoria = obrigatoria ? "1" : "";
}
function fecharModal() { $("modal").hidden = true; itemPendenteNc = null; }

$("btnNc").addEventListener("click", () => abrirModalNc(null, false));
$("ncCancel").addEventListener("click", fecharModal);
$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") fecharModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("modal").hidden) fecharModal(); });

$("ncSave").addEventListener("click", async () => {
  const descricao = $("ncDesc").value.trim();
  if (descricao.length < 5) { $("ncErr").textContent = "Descreva o problema com pelo menos 5 caracteres."; $("ncErr").hidden = false; return; }
  const item = itemPendenteNc;
  const payload = { obraId: state.obra.id, inspecaoId: state.inspecao.id, itemId: item?.id ?? null,
                    descricao, gravidade: $("ncSev").value };
  $("ncSave").disabled = true;
  try {
    let nc = { id: Date.now() };
    if (!state.offline) nc = await api(ENDPOINTS.ncCriar, { method: "POST", body: payload });
    if (item) { item.naoConformidadeId = nc.id; await salvarResultado(item, "NOK"); }
    state.obra.ncAbertas = (state.obra.ncAbertas ?? 0) + 1;
    state.atividades.unshift({ titulo: "Não conformidade aberta", autor: state.obra.inspetor, quando: "Agora" });
    renderObra(); renderAtividades(); fecharModal();
    toast("Não conformidade registrada.");
  } catch (err) {
    $("ncErr").textContent = "Não foi possível registrar a NC. Tente novamente."; $("ncErr").hidden = false;
  } finally { $("ncSave").disabled = false; }
});

/* ---------- Finalizar ---------- */
$("btnFinalizar").addEventListener("click", async () => {
  const faltam = state.itens.filter(i => !i.resultado).length;
  if (faltam) { toast(`Responda os ${faltam} itens restantes para finalizar.`); return; }
  const semNc = state.itens.filter(i => i.resultado === "NOK" && !i.naoConformidadeId && !state.offline);
  if (semNc.length) { toast("Todo item NOK precisa ter uma NC aberta."); return; }

  const btn = $("btnFinalizar"); btn.disabled = true;
  try {
    if (!state.offline) await api(ENDPOINTS.finalizar(state.inspecao.id), { method: "POST" });
    toast("Inspeção finalizada.");
    setSave("Inspeção finalizada");
  } catch (e) {
    toast("Não foi possível finalizar a inspeção.");
    btn.disabled = false;
  }
});

carregar();
