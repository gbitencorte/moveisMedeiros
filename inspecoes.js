/* Móveis Medeiros · Checklist de inspeção — integrado ao CONTRATO_API v2.0 */
const API_BASE_URL = "http://localhost:5173"; // ajuste a porta (launchSettings.json)

const ETAPAS = { MEDIDA:"Medida", PROJETO:"Projeto", MATERIAL:"Material", MONTAGEM:"Montagem", INSTALACAO:"Instalação", ACABAMENTO:"Acabamento" };
const STATUS = { PENDENTE:"Pendente", EM_EXECUCAO:"Em execução", CONCLUIDO:"Concluído" };
const CARGOS = { LIDER:"Líder / Inspetor", MONTADOR:"Montador", AUXILIAR:"Auxiliar" };

const state = { usuario:null, pedido:null, itens:[], resumo:null, demo:false };
let itemPendenteNc = null, pollId = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const iniciais = (n="") => n.split(" ").filter(Boolean).slice(0,2).map(p => p[0]).join("").toUpperCase();
// Sem login nesta tela: o token vem do localStorage ("token"), gravado pela futura tela de login.
// Para testar a API real antes disso, cole um token JWT em DEV_TOKEN (gere pelo arquivo .http da API).
// Sem token nenhum, a tela roda em MODO DEMONSTRAÇÃO com dados de exemplo.
const DEV_TOKEN = "";
// Login automático (provisório): a API exige token em todas as rotas, então a tela entra sozinha
// com esta conta, sem pedir nada ao usuário. Troque pelos dados reais do admin (Seed) e NÃO versione a senha.
// Deixe email vazio ("") para desligar e voltar ao modo demonstração / token do localStorage.
const AUTO_LOGIN = { email: "admin@moveismedeiros.com.br", senha: "Troque@123" };
const LOGIN_URL = ""; // ex.: "login.html" — para onde ir quando a sessão expirar
const token = () => localStorage.getItem("token") || DEV_TOKEN;
const ehLider = () => state.usuario?.cargo === "LIDER";

/* ---------- Datas (API em UTC; exibição em America/Sao_Paulo) ---------- */
const TZ = "America/Sao_Paulo";
function fmtData(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const dia = (x) => x.toLocaleDateString("pt-BR", { timeZone: TZ });
  const hora = d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
  return dia(d) === dia(new Date()) ? `Hoje, ${hora}` : `${d.toLocaleDateString("pt-BR", { timeZone: TZ, day:"2-digit", month:"2-digit" })}, ${hora}`;
}

/* ---------- HTTP ---------- */
class ApiError extends Error {
  constructor(status, data) { super(data?.detail || `HTTP ${status}`); this.status = status; this.code = data?.code; this.data = data; }
}
async function api(path, { method = "GET", body } = {}) {
  if (state.demo) return mockApi(path, method, body);
  const isForm = body instanceof FormData;
  const res = await fetch(API_BASE_URL + path, {
    method,
    headers: { ...(body && !isForm ? { "Content-Type": "application/json" } : {}), ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new ApiError(res.status, data);
    if (res.status === 401 && err.code === "NAO_AUTENTICADO") sair();
    throw err;
  }
  return data;
}
// Decide pelo code/status, nunca pelo texto de detail
function msgErro(e) {
  if (!(e instanceof ApiError)) return "Não foi possível conectar ao servidor.";
  if (e.code === "VALIDACAO_FALHOU" && e.data?.errors) return Object.values(e.data.errors).flat().join(" ");
  return ({
    CREDENCIAIS_INVALIDAS: "E-mail ou senha incorretos.",
    NAO_AUTENTICADO: "Sua sessão expirou. Entre novamente.",
    SEM_PERMISSAO: "Você não tem permissão para esta ação.",
    NAO_ENCONTRADO: "Registro não encontrado.",
    NC_DUPLICADA: `Já existe uma NC aberta para este ponto (id ${e.data?.ncExistenteId}).`,
    TRANSICAO_INVALIDA: "Essa ação não é permitida no estado atual.",
    ETAPA_INCOMPLETA: "Ainda há itens ou NCs em aberto.",
    ETAPA_INVALIDA: "Só é possível responder itens da etapa atual.",
    PEDIDO_CONCLUIDO: "Este pedido já foi concluído.",
    ERRO_INTERNO: "Erro no servidor. Tente novamente.",
  })[e.code] || "Não foi possível concluir a ação.";
}

function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200); }
const setSave = (m) => ($("saveState").textContent = m);

/* ---------- Sessão ---------- */
function sair() {
  localStorage.removeItem("token"); clearInterval(pollId);
  if (AUTO_LOGIN.email) { location.reload(); return; } // refaz o login automático
  if (LOGIN_URL) location.href = LOGIN_URL; else toast("Sessão expirada. Faça login novamente.");
}

async function iniciar() {
  if (!token() && AUTO_LOGIN.email) {
    try {
      const r = await api("/auth/login", { method: "POST", body: { email: AUTO_LOGIN.email, senha: AUTO_LOGIN.senha } });
      localStorage.setItem("token", r.accessToken);
    } catch (e) { toast("Login automático falhou: " + msgErro(e)); }
  }
  state.demo = !token();
  if (state.demo) toast("Modo demonstração (sem login): dados de exemplo.");
  try {
    state.usuario = await api("/auth/me");
    await carregarPedido();
    await atualizarResumo();
    clearInterval(pollId); pollId = setInterval(atualizarResumo, 30000);
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 401)) { setSave("Falha ao carregar."); toast(msgErro(e)); }
  }
}

/* ---------- Carregamento ---------- */
async function carregarPedido() {
  let id = new URLSearchParams(location.search).get("pedido");
  if (!id) {
    const lista = await api("/pedidos?page=1&pageSize=1");
    if (!lista.items.length) { toast("Nenhum pedido disponível."); return; }
    id = lista.items[0].id;
  }
  state.pedido = await api(`/pedidos/${id}`);
  state.itens = await api(`/pedidos/${id}/checklist?etapa=${state.pedido.etapaAtual}`);
  renderTudo();
  setSave("Atualizado agora");
}
async function recarregarPedido() {
  const id = state.pedido.id;
  state.pedido = await api(`/pedidos/${id}`);
  renderObra(); renderProgresso(); renderAtividades(); renderBotaoFinal();
}
async function recarregarChecklist() {
  state.itens = await api(`/pedidos/${state.pedido.id}/checklist?etapa=${state.pedido.etapaAtual}`);
  renderItens(); renderProgresso();
}
async function atualizarResumo() {
  try { state.resumo = await api("/resumo"); $("badgeInsp").textContent = state.resumo.inspecoesPendentes; $("badgeNc").textContent = state.resumo.ncAbertas; } catch {}
}

/* ---------- Render ---------- */
function renderTudo() { renderObra(); renderItens(); renderProgresso(); renderAtividades(); renderBotaoFinal(); }

function renderObra() {
  const p = state.pedido, u = state.usuario;
  $("obraTitulo").textContent = $("heroTitulo").textContent = p.nomeObra;
  $("obraPedido").textContent = `Pedido #${p.numero}`;
  $("heroEndereco").textContent = `${p.cliente.nome} · ${p.endereco}`;
  $("obraStatus").textContent = (STATUS[p.status] || p.status).toUpperCase();
  $("obraStatus").classList.toggle("concluida", p.status === "CONCLUIDO");
  $("metaEtapa").textContent = ETAPAS[p.etapaAtual];
  $("metaPrazo").textContent = fmtData(p.prazo);
  $("metaInspetor").textContent = p.inspetor.nome;
  document.querySelector(".eyebrow").textContent = `INSPEÇÃO DE ${ETAPAS[p.etapaAtual].toUpperCase()}`;
  $("userName").textContent = u.nome;
  document.querySelector(".user-info span").textContent = CARGOS[u.cargo] || u.cargo;
  $("userAvatar").textContent = $("topAvatar").textContent = iniciais(u.nome);
}

const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg>';
function renderItens() {
  const travado = state.pedido.status === "CONCLUIDO";
  $("itens").innerHTML = state.itens.map((it, i) => {
    const bloqueado = travado || it.naoConformidadeId != null; // com NC vinculada o resultado não muda
    const btn = (v, txt) => `<button type="button" class="${v.toLowerCase()} ${it.resultado === v ? "on" : ""}" data-id="${it.id}" data-valor="${v}" aria-pressed="${it.resultado === v}" ${bloqueado ? "disabled" : ""}>${txt}</button>`;
    const tag = it.resultado === "NOK" ? `<span class="nc-tag">${it.naoConformidadeId ? "NC aberta" : "NC pendente"}</span>` : "";
    return `<li class="item">
      <div class="item-label"><span class="n">${String(i + 1).padStart(2, "0")}</span><span>${esc(it.descricao)}${tag}</span></div>
      <div class="seg" role="group" aria-label="Resultado do item ${i + 1}">${btn("OK", CHECK + "OK")}${btn("NOK", "NOK")}${btn("NA", "NA")}</div>
    </li>`;
  }).join("") || '<li class="item"><span class="sub">Nenhum item nesta etapa.</span></li>';
}
function renderProgresso() {
  const resp = state.itens.filter(i => i.resultado !== "NAO_RESPONDIDO").length;
  $("contador").textContent = `${resp} de ${state.itens.length}`;
  const pct = state.pedido.progressoPercentual; // calculado pelo back
  $("progPct").textContent = pct + "%"; $("progBar").style.width = pct + "%";
}
function renderAtividades() {
  $("atividades").innerHTML = state.pedido.atividadesRecentes.map(a =>
    `<li><i></i><div><b>${esc(a.descricao)}</b><span>Por ${esc(a.usuarioNome)}</span><time>${esc(fmtData(a.criadaEm))}</time></div></li>`
  ).join("") || '<li><div><span>Nenhuma atividade ainda.</span></div></li>';
}
function renderBotaoFinal() {
  const p = state.pedido, b = $("btnFinalizar");
  b.hidden = !ehLider() || p.status === "CONCLUIDO";
  b.textContent = p.podeConcluir ? "Concluir pedido" : p.podeAvancarEtapa ? "Avançar etapa" : "Finalizar inspeção";
}

/* ---------- Responder item (sem atualização otimista) ---------- */
$("itens").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-id]"); if (!b || b.disabled) return;
  const item = state.itens.find(i => String(i.id) === b.dataset.id), valor = b.dataset.valor;
  if (item.resultado === valor) { if (valor === "NOK") abrirModalNc(item); return; }
  setSave("Salvando…");
  try {
    const r = await api(`/checklist-itens/${item.id}`, { method: "PUT", body: { resultado: valor } });
    state.itens = state.itens.map(i => (i.id === r.item.id ? r.item : i));
    renderItens(); renderProgresso(); setSave("Salvo agora");
    recarregarPedido(); atualizarResumo();
    if (r.exigeNc) abrirModalNc(r.item);
  } catch (err) { setSave("Falha ao salvar."); toast(msgErro(err)); }
});

/* ---------- Foto: lê metadados antes de comprimir (a compressão apaga o EXIF) ---------- */
async function comprimir(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  let q = 0.85, blob;
  do { blob = await new Promise(r => c.toBlob(r, "image/jpeg", q)); q -= 0.1; } while (blob.size > 1024 * 1024 && q > 0.3);
  return blob;
}

/* ---------- Não conformidade ---------- */
function abrirModalNc(item) {
  itemPendenteNc = item || null;
  const p = state.pedido;
  $("modalItem").textContent = item ? `Item: ${item.descricao}` : `Etapa: ${ETAPAS[p.etapaAtual]}`;
  ["ncTitulo","ncDesc","ncAcao","ncPrazo","ncFoto"].forEach(id => ($(id).value = ""));
  if (item) $("ncTitulo").value = item.descricao.slice(0, 150);
  $("ncCausa").innerHTML = Object.entries(ETAPAS).map(([k, v]) => `<option value="${k}" ${k === p.etapaAtual ? "selected" : ""}>${v}</option>`).join("");
  const pessoas = [{ id: p.inspetor.id, nome: `${p.inspetor.nome} (inspetor)` }, ...p.equipe.map(m => ({ id: m.id, nome: m.nome }))];
  $("ncResp").innerHTML = '<option value="">Selecione…</option>' + pessoas.map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join("");
  $("ncFotoPrev").hidden = true; $("ncErr").hidden = true; $("modal").hidden = false; $("ncTitulo").focus();
}
const fecharModal = () => { $("modal").hidden = true; itemPendenteNc = null; };
$("btnNc").addEventListener("click", () => abrirModalNc(null));
$("ncCancel").addEventListener("click", fecharModal);
$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") fecharModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("modal").hidden) fecharModal(); });
$("ncFoto").addEventListener("change", () => {
  const f = $("ncFoto").files[0], img = $("ncFotoPrev");
  if (!f) { img.hidden = true; return; }
  img.src = URL.createObjectURL(f); img.hidden = false;
});

$("ncSave").addEventListener("click", async () => {
  const v = (id) => $(id).value.trim(), erro = (m) => { $("ncErr").textContent = m; $("ncErr").hidden = false; };
  const nomes = { ncTitulo:"Título", ncDesc:"Descrição técnica", ncAcao:"Ação corretiva", ncResp:"Funcionário responsável", ncPrazo:"Prazo" };
  const falta = Object.keys(nomes).filter(id => !v(id));
  if (falta.length) return erro(`Preencha: ${falta.map(id => nomes[id]).join(", ")}.`);
  const foto = $("ncFoto").files[0];
  if (!foto) return erro("Anexe a foto da não conformidade.");

  $("ncSave").disabled = true;
  try {
    const metadados = { capturadaEm: new Date(foto.lastModified).toISOString() };
    const blob = await comprimir(foto);
    const fd = new FormData();
    fd.append("pedidoId", state.pedido.id);
    fd.append("etapa", state.pedido.etapaAtual);
    if (itemPendenteNc) fd.append("checklistItemId", itemPendenteNc.id);
    fd.append("ponto", v("ncTitulo"));
    fd.append("descricao", v("ncDesc"));
    fd.append("acaoCorretiva", v("ncAcao"));
    fd.append("causaRaiz", $("ncCausa").value);
    fd.append("responsavelId", $("ncResp").value);
    fd.append("prazo", new Date($("ncPrazo").value).toISOString());
    fd.append("metadados", JSON.stringify(metadados));
    fd.append("foto", blob, "foto.jpg");
    const nc = await api("/nao-conformidades", { method: "POST", body: fd });
    fecharModal(); toast(`Não conformidade ${nc.numero} registrada.`);
    await recarregarChecklist(); await recarregarPedido(); atualizarResumo();
  } catch (e) { erro(msgErro(e)); }
  finally { $("ncSave").disabled = false; }
});

/* ---------- Avançar etapa / concluir (único fechamento previsto no contrato) ---------- */
$("btnFinalizar").addEventListener("click", async () => {
  const p = state.pedido;
  if (!p.podeConcluir && !p.podeAvancarEtapa) return toast("Ainda há itens ou NCs em aberto nesta etapa.");
  const b = $("btnFinalizar"); b.disabled = true;
  try {
    state.pedido = await api(`/pedidos/${p.id}/${p.podeConcluir ? "concluir" : "avancar-etapa"}`, { method: "POST" });
    await recarregarChecklist(); renderTudo(); atualizarResumo();
    toast(p.podeConcluir ? "Pedido concluído." : "Etapa avançada.");
  } catch (e) { toast(msgErro(e)); }
  finally { b.disabled = false; }
});


/* ---------- Modo demonstração (sem token): imita as respostas da API ---------- */
const DEMO = {
  etapa: "MONTAGEM", ncAbertas: 1, atividades: [
    { id: 2, acao: "CHECKLIST_RESPONDIDO", descricao: 'Rafael Medeiros marcou NOK em "Ajuste de portas e gavetas"', usuarioNome: "Rafael Medeiros", criadaEm: new Date(Date.now() - 6e5).toISOString() },
    { id: 1, acao: "PEDIDO_CRIADO", descricao: "Diego Alves atualizou a montagem", usuarioNome: "Diego Alves", criadaEm: new Date(Date.now() - 3.6e6).toISOString() },
  ],
  itens: [
    [1, "Alinhamento e nivelamento dos módulos", "OK", null], [2, "Fixação e estabilidade das estruturas", "OK", null],
    [3, "Ajuste de portas e gavetas", "NOK", 1], [4, "Integridade do acabamento", "NAO_RESPONDIDO", null],
    [5, "Limpeza e proteção do ambiente", "NAO_RESPONDIDO", null],
  ].map(([id, descricao, resultado, naoConformidadeId]) => ({ id, pedidoId: 1, etapa: "MONTAGEM", ordem: id, descricao, resultado, naoConformidadeId })),
};
function demoPedido() {
  const it = DEMO.itens, fechado = (i) => i.resultado === "OK" || i.resultado === "NA";
  const tudoFechado = it.every(fechado) && DEMO.ncAbertas === 0;
  const prazo = new Date(); prazo.setHours(21, 0, 0, 0);
  return {
    id: 1, numero: "MM-0248", nomeObra: "Residência Andrade", endereco: "Jardim Europa, São Paulo",
    cliente: { id: 1, nome: "Carolina Andrade" }, status: DEMO.etapa === "ACABAMENTO" && tudoFechado ? "EM_EXECUCAO" : "EM_EXECUCAO",
    etapaAtual: DEMO.etapa, prazo: prazo.toISOString(), inspetor: { id: 1, nome: "Rafael Medeiros" },
    progressoPercentual: Math.round((it.filter(fechado).length / it.length) * 100), totalNcAbertas: DEMO.ncAbertas,
    descricao: null, dataInspecao: null, etapaInicial: "MEDIDA",
    equipe: [{ id: 2, nome: "Diego Alves", cargo: "MONTADOR" }, { id: 3, nome: "Marcos Lima", cargo: "AUXILIAR" }],
    etapasConcluidas: [], podeAvancarEtapa: tudoFechado && DEMO.etapa !== "ACABAMENTO", podeConcluir: tudoFechado && DEMO.etapa === "ACABAMENTO",
    atividadesRecentes: DEMO.atividades.slice(0, 5),
  };
}
function mockApi(path, method, body) {
  const ok = (d) => Promise.resolve(structuredClone(d));
  const nova = (txt) => DEMO.atividades.unshift({ id: Date.now(), acao: "DEMO", descricao: txt, usuarioNome: "Rafael Medeiros", criadaEm: new Date().toISOString() });
  if (path === "/auth/me") return ok({ id: 1, nome: "Rafael Medeiros", email: "demo@local", cargo: "LIDER", ativo: true });
  if (path.startsWith("/pedidos?")) return ok({ items: [demoPedido()], page: 1, pageSize: 1, totalItems: 1, totalPages: 1 });
  if (path === "/pedidos/1") return ok(demoPedido());
  if (path.startsWith("/pedidos/1/checklist")) return ok(DEMO.itens);
  if (path === "/resumo") return ok({ inspecoesPendentes: 3, ncAbertas: DEMO.ncAbertas, notificacoesNaoLidas: 0 });
  let m = path.match(/^\/checklist-itens\/(\d+)$/);
  if (m && method === "PUT") {
    const item = DEMO.itens.find(i => i.id === +m[1]);
    if (item.naoConformidadeId) return Promise.reject(new ApiError(409, { code: "TRANSICAO_INVALIDA" }));
    item.resultado = body.resultado;
    nova(`Rafael Medeiros marcou ${body.resultado} em "${item.descricao}"`);
    return ok({ item, exigeNc: item.resultado === "NOK" });
  }
  if (path === "/nao-conformidades" && method === "POST") {
    const id = (DEMO.ncSeq = (DEMO.ncSeq || 1) + 1), itemId = body.get("checklistItemId");
    if (itemId) DEMO.itens.find(i => i.id === +itemId).naoConformidadeId = id;
    DEMO.ncAbertas++; nova(`Rafael Medeiros abriu a NC-${String(id).padStart(3, "0")}`);
    return ok({ id, numero: `NC-${String(id).padStart(3, "0")}` });
  }
  if (/^\/pedidos\/1\/(avancar-etapa|concluir)$/.test(path)) {
    const ordem = Object.keys(ETAPAS), prox = ordem[ordem.indexOf(DEMO.etapa) + 1];
    if (path.endsWith("avancar-etapa") && prox) { DEMO.etapa = prox; DEMO.itens = [1, 2, 3].map(n => ({ id: 100 + n, pedidoId: 1, etapa: prox, ordem: n, descricao: `Item de exemplo ${n}`, resultado: "NAO_RESPONDIDO", naoConformidadeId: null })); }
    nova(path.endsWith("concluir") ? "Rafael Medeiros concluiu o pedido" : `Rafael Medeiros avançou para a etapa ${ETAPAS[prox]}`);
    return ok(demoPedido());
  }
  return Promise.reject(new ApiError(404, { code: "NAO_ENCONTRADO" }));
}

/* ---------- Início ---------- */
iniciar();