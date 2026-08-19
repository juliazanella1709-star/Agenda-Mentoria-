import React, { useState, useEffect, useMemo, Suspense } from "react";
import {
  Calendar, Plus, Phone, Trash2, Pencil, ChevronLeft, ChevronRight,
  Search, X, Check, CalendarDays, User, Instagram, AlertCircle,
  Users, Wallet, TrendingUp, List, Clock, RotateCcw, PhoneCall, MessageCircle, Package, Minus, Eye, EyeOff, LogOut,
  FileSpreadsheet, ClipboardList,
} from "lucide-react";
import { auth as fbAuth } from "./firebase";
import { store } from "./store";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

// Carregado sob demanda: o recharts so desce ao abrir a aba Faturamento.
const FaturamentoChart = React.lazy(() => import("./Chart"));
// Idem: a biblioteca de Excel so desce ao abrir a aba Exportar.
const ExportView = React.lazy(() => import("./Export"));
const ProcedimentosView = React.lazy(() => import("./Procedimentos"));

// ---- Tema ------------------------------------------------------------------
const C = {
  bg: "#F4F2EF",
  surface: "#FFFFFF",
  ink: "#26232A",
  teal: "#5E6A79",
  tealSoft: "#EEF0F3",
  coral: "#A05574",
  coralSoft: "#F5E8ED",
  line: "#EAE7E3",
  muted: "#6E6A72",
  faint: "#A6A2AA",
  money: "#26232A",
  goodBg: "#D8F0DE",
  goodFg: "#1C6B39",
  warnBg: "#FDF0D2",
  warnFg: "#8A5A0E",
};

const STATUS = {
  pendente:   { label: "Pendente",  bg: "#FBEECF", fg: "#8A6410", dot: "#E0A727" },
  confirmado: { label: "Confirmado", bg: "#D8F0DE", fg: "#1C6B39", dot: "#25A458" },
  concluido:  { label: "Concluído", bg: "#DCE8F7", fg: "#2B5488", dot: "#3B7DD8" },
  cancelado:  { label: "Cancelado", bg: "#EFEBEA", fg: "#8B8188", dot: "#B4A9AE" },
};

const PROCS_PADRAO = [
  { nome: "Harmonização Full Face – 3ml", vista: 1200, parc: 1300 },
  { nome: "Preenchimento labial", vista: 600, parc: 650 },
  { nome: "Preenchimento (demais regiões)", vista: 500, parc: 550 },
  { nome: "Bioestimulador de colágeno (Radiesse)", vista: 980, parc: 1100 },
  { nome: "Bioestimulador de colágeno (DIAMOND)", vista: 780, parc: 990 },
  { nome: "Botox global (testa + glabela + olhos)", vista: 600, parc: 650 },
  { nome: "Combo: Lábio + Botox Global", vista: 1150, parc: 1250 },
  { nome: "Harmonização Natural (1ml + Botox)", vista: 1050, parc: 1150 },
  { nome: "Protocolo Avançado (3ml + Bioestimulador DIAMOND)", vista: 1950, parc: 2100 },
];
// Catalogo agora e editavel e mora no banco; PROCS_PADRAO e so a semente do
// primeiro acesso. procByName recebe a lista para nao depender de global.
const procByNameIn = (lista, n) => (lista || []).find((p) => p.nome === n);

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho",
  "Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ---- Helpers ---------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayKey = () => keyOf(new Date());
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const prettyDate = (k) => { const d = parseKey(k); return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`; };
const shortDate = (k) => { const d = parseKey(k); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
const ymOf = (k) => k.slice(0, 7);
const tituloMes = (ym) => { const [y, m] = ym.split("-").map(Number);
  const agora = new Date();
  const mesmoAno = y === agora.getFullYear();
  return mesmoAno ? MESES[m - 1] : `${MESES[m - 1]} de ${y}`; };

const toNum = (s) => {
  if (typeof s === "number") return s;
  if (!s) return 0;
  const clean = String(s).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};
const brl = (v) => toNum(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const igHandle = (s) => (s || "").replace(/^@+/, "");
// "Leticia  BEZERRA" e "Letícia Bezerra" devem bater como a mesma pessoa
const normNome = (s) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const procsLabel = (it) => [it && it.procedure, ...(((it && it.procedures) || []))].filter(Boolean).join(" + ");
const procsText = (it) => [it && it.procedure, ...(((it && it.procedures) || []))].filter(Boolean).join(" ");
const initials = (name) => (name || "").trim().split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase() || "?";

const valorDe = (it) => toNum(it.valor);
const pagList = (it) => (it.pagamentos && it.pagamentos.length) ? it.pagamentos : (toNum(it.sinal) > 0 ? [{ valor: it.sinal, forma: it.formaPgto, conta: it.sinalPara, parcelas: it.parcelas }] : []);
const pagResumo = (it) => pagList(it).filter((p) => toNum(p.valor) > 0).map((p) => `${p.forma || "?"}${p.conta ? " " + p.conta : ""}`).join(" + ");
const totalPagoDe = (it) => pagList(it).reduce((s, p) => s + toNum(p.valor), 0);
const recebidoDe = (it) => { const v = valorDe(it), pg = totalPagoDe(it); return v > 0 ? Math.min(pg, v) : pg; };
const saldoDe = (it) => Math.max(valorDe(it) - totalPagoDe(it), 0);

function derivePatients(items, people = []) {
  const map = {};
  for (const it of items) {
    const key = (it.patient || "").trim().toLowerCase();
    if (!key) continue;
    if (!map[key]) map[key] = { name: it.patient.trim(), phone: "", instagram: "", visits: [], valor: 0, pago: 0 };
    const p = map[key];
    p.name = it.patient.trim();
    if (it.phone) p.phone = it.phone;
    if (it.instagram) p.instagram = igHandle(it.instagram);
    if (it.status !== "cancelado") {
      p.visits.push(it);
      p.valor += valorDe(it);
      p.pago += recebidoDe(it);
    }
  }
  for (const pe of people) {
    const key = (pe.name || "").trim().toLowerCase();
    if (!key) continue;
    if (!map[key]) map[key] = { name: pe.name.trim(), phone: "", instagram: "", visits: [], valor: 0, pago: 0 };
    if (pe.phone) map[key].phone = pe.phone;
    if (pe.instagram) map[key].instagram = igHandle(pe.instagram);
  }
  const today = todayKey();
  return Object.values(map).map((p) => {
    const dates = p.visits.map((v) => v.date).sort();
    const past = dates.filter((d) => d <= today);
    const future = dates.filter((d) => d > today);
    return {
      ...p, count: p.visits.length,
      last: past.length ? past[past.length - 1] : (dates[dates.length - 1] || null),
      next: future.length ? future[0] : null,
      aReceber: Math.max(p.valor - p.pago, 0),
    };
  }).sort((a, b) => (b.next ? 1 : 0) - (a.next ? 1 : 0) || a.name.localeCompare(b.name));
}

function billingForMonth(items, ym) {
  const list = items.filter((it) => ymOf(it.date) === ym && it.status !== "cancelado");
  const faturado = list.reduce((s, it) => s + valorDe(it), 0);
  const recebido = list.reduce((s, it) => s + recebidoDe(it), 0);
  const aReceber = list.reduce((s, it) => s + saldoDe(it), 0);
  return { faturado, recebido, aReceber, atend: list.length };
}
function last6Months(items, ym) {
  const [y, m] = ym.split("-").map(Number);
  const out = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const fat = items.filter((it) => ymOf(it.date) === k && it.status !== "cancelado").reduce((s, it) => s + valorDe(it), 0);
    out.push({ mes: MESES[d.getMonth()].slice(0, 3), faturado: fat });
  }
  return out;
}
function topProcs(items, ym) {
  const map = {};
  items.filter((it) => ymOf(it.date) === ym && it.status !== "cancelado" && valorDe(it) > 0)
    .forEach((it) => { const p = procsLabel(it) || "Sem procedimento"; map[p] = (map[p] || 0) + valorDe(it); });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
}

const LOGO = "data:image/jpeg;base64,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";
const catDe = (proc) => {
  const p = (proc || "").toLowerCase();
  return { botox: /botox/.test(p), harmo: /(combo|harmoniza|protocolo|full face)/.test(p) };
};
const daysSince = (dateStr) => {
  const d = parseKey(dateStr); const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.floor((today - d) / 86400000);
};
const humanAgo = (dateStr) => {
  const d = daysSince(dateStr);
  if (d <= 0) return "hoje";
  if (d < 30) return `há ${d} dia${d > 1 ? "s" : ""}`;
  const meses = Math.round(d / 30);
  return `há ${meses} ${meses > 1 ? "meses" : "mês"}`;
};
function deriveRetornos(items) {
  const map = {};
  for (const it of items) {
    if (it.status === "cancelado") continue;
    const key = (it.patient || "").trim().toLowerCase();
    if (!key) continue;
    const c = catDe(procsText(it));
    if (!c.botox && !c.harmo) continue;
    if (!map[key]) map[key] = { name: it.patient.trim(), phone: "", instagram: "" };
    const m = map[key];
    m.name = it.patient.trim();
    if (it.phone) m.phone = it.phone;
    if (it.instagram) m.instagram = igHandle(it.instagram);
    if (c.botox && (!m.botox || it.date > m.botox.date)) m.botox = { date: it.date, proc: it.procedure };
    if (c.harmo && (!m.harmo || it.date > m.harmo.date)) m.harmo = { date: it.date, proc: it.procedure };
  }
  return Object.values(map);
}

const RECALL = [
  { cat: "botox", label: "Botox", dias: 150, re: /botox/ },
  { cat: "bio", label: "Bioestimulador", dias: 180, re: /bioestimulador|radiesse|diamond/ },
  { cat: "harmo", label: "Harmonização", dias: 120, re: /combo|harmoniza|protocolo|full face|preenchimento/ },
];
const chamarLabel = (chamarKey) => {
  const d = daysSince(chamarKey);
  if (d === 0) return "chamar hoje";
  if (d > 0) return `atrasado ${d} dia${d > 1 ? "s" : ""}`;
  const f = -d;
  if (f < 30) return `em ${f} dia${f > 1 ? "s" : ""}`;
  const m = Math.round(f / 30);
  return `em ${m} ${m > 1 ? "meses" : "mês"}`;
};
function deriveChamar(items) {
  const map = {};
  for (const it of items) {
    if (it.status === "cancelado") continue;
    const key = (it.patient || "").trim().toLowerCase();
    if (!key) continue;
    const p = procsText(it).toLowerCase();
    for (const r of RECALL) {
      if (!r.re.test(p)) continue;
      if (!map[key]) map[key] = { name: it.patient.trim(), phone: "", instagram: "", cats: {} };
      const m = map[key];
      m.name = it.patient.trim();
      if (it.phone) m.phone = it.phone;
      if (it.instagram) m.instagram = igHandle(it.instagram);
      if (!m.cats[r.cat] || it.date > m.cats[r.cat].date) m.cats[r.cat] = { date: it.date, label: r.label, dias: r.dias };
    }
  }
  return Object.values(map).map((m) => {
    const entries = Object.entries(m.cats).map(([cat, v]) => {
      const base = parseKey(v.date); const ch = new Date(base); ch.setDate(ch.getDate() + v.dias);
      const chamarKey = keyOf(ch);
      return { cat, label: v.label, date: v.date, chamarKey, overdue: daysSince(chamarKey) >= 0 };
    });
    entries.sort((a, b) => a.chamarKey.localeCompare(b.chamarKey));
    return { ...m, entries, urgente: entries[0] };
  });
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const STORAGE_KEY = "agenda:consultas:v2";
const NOTES_KEY = "agenda:afazeres:v1";
const PEOPLE_KEY = "agenda:pacientes:v1";
const STOCK_KEY = "agenda:estoque:v1";
const PROCS_KEY = "agenda:procedimentos:v1";
const CHAMADAS_KEY = "agenda:chamadas:v1";

// ---- App -------------------------------------------------------------------
export default function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("agenda");
  const [selected, setSelected] = useState(todayKey());
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [modal, setModal] = useState(null);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState(null);
  const [dayMode, setDayMode] = useState("lista");
  const [historyPatient, setHistoryPatient] = useState(null);
  const [agendaView, setAgendaView] = useState("dia");
  const [weekSpan, setWeekSpan] = useState(3);
  const [notas, setNotas] = useState([]);
  const [people, setPeople] = useState([]);
  const [patientForm, setPatientForm] = useState(null);
  const [estoque, setEstoque] = useState([]);
  const [estoqueForm, setEstoqueForm] = useState(null);
  const [procs, setProcs] = useState(PROCS_PADRAO);
  // { "nome|categoria": { em: "AAAA-MM-DD", ref: data da consulta que gerou o prazo } }
  const [chamadas, setChamadas] = useState({});
  const [auth, setAuth] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=Cormorant+Garamond:wght@500;600&family=Inter:wght@400;500;600&display=swap";
    document.head.appendChild(l);
    const s = document.createElement("style");
    s.textContent = `
      .ff-d{font-family:'Bricolage Grotesque',system-ui,sans-serif}
      .ff-b{font-family:'Inter',system-ui,sans-serif}
      .ff-serif{font-family:'Cormorant Garamond',Georgia,serif}
      .ag-scroll::-webkit-scrollbar{width:8px}
      .ag-scroll::-webkit-scrollbar-thumb{background:#d7d5cb;border-radius:8px}
      .ag-nav::-webkit-scrollbar{height:0}
      .ag-fade{animation:agf .25s ease}
      @keyframes agf{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
      .ag-pop{animation:agp .22s cubic-bezier(.2,.9,.3,1.2)}
      @keyframes agp{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}
      *:focus-visible{outline:2px solid ${C.coral};outline-offset:2px}
    `;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    if (!auth) return;
    let cancelado = false;
    setLoading(true);
    const ler = (k) => store.get(k).catch(() => null);
    const parse = (r) => { try { return r && r.value ? JSON.parse(r.value) : null; } catch (_) { return null; } };
    (async () => {
      // Em paralelo: antes eram 4 idas ao Firestore em fila, uma esperando a outra.
      const [c, n, p, e, pr, ch] = await Promise.all([
        ler(STORAGE_KEY), ler(NOTES_KEY), ler(PEOPLE_KEY), ler(STOCK_KEY), ler(PROCS_KEY), ler(CHAMADAS_KEY),
      ]);
      if (cancelado) return;
      const vc = parse(c); if (vc) setItems(vc);
      const vn = parse(n); if (vn) setNotas(vn);
      const vp = parse(p); if (vp) setPeople(vp);
      const ve = parse(e); if (ve) setEstoque(ve);
      const vpr = parse(pr); if (vpr && vpr.length) setProcs(vpr);
      const vch = parse(ch); if (vch) setChamadas(vch);
      setLoading(false);
    })();
    return () => { cancelado = true; };
  }, [auth]);

  const persist = async (next) => {
    setItems(next);
    try { await store.set(STORAGE_KEY, JSON.stringify(next)); }
    catch (_) { flash("Não consegui salvar — os dados valem só nesta sessão."); }
  };
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const save = async (data) => {
    let next;
    if (data.id) { next = items.map((it) => (it.id === data.id ? data : it)); flash("Consulta atualizada."); }
    else { next = [...items, { ...data, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }]; flash("Consulta agendada."); }
    await persist(next);
    setSelected(data.date);
    setCursor({ y: parseKey(data.date).getFullYear(), m: parseKey(data.date).getMonth() });
    setModal(null);
  };
  const remove = async (id) => { await persist(items.filter((it) => it.id !== id)); flash("Consulta removida."); };
  const setStatus = async (id, status) => persist(items.map((it) => (it.id === id ? { ...it, status } : it)));

  const goView = (v) => { setView(v); setQuery(""); };
  const openNew = () => setModal({ date: selected, time: "09:00", endTime: "10:00", status: "pendente", valor: "", sinal: "" });
  const openNewFor = (p) => setModal({ date: selected, time: "09:00", endTime: "10:00", status: "pendente", valor: "", sinal: "", patient: p.name, phone: p.phone || "", instagram: p.instagram || "" });
  const verPaciente = (name) => { setQuery(name); setView("agenda"); };
  const openHistory = (name) => setHistoryPatient(name);
  const persistNotas = async (next) => { setNotas(next); try { await store.set(NOTES_KEY, JSON.stringify(next)); } catch (_) {} };
  const addNota = (text) => persistNotas([...notas, { id: uid(), text, done: false }]);
  const toggleNota = (id) => persistNotas(notas.map((n) => (n.id === id ? { ...n, done: !n.done } : n)));
  const delNota = (id) => persistNotas(notas.filter((n) => n.id !== id));
  const persistPeople = async (next) => { setPeople(next); try { await store.set(PEOPLE_KEY, JSON.stringify(next)); } catch (_) {} };
  const savePerson = (data) => {
    const next = data.id ? people.map((p) => (p.id === data.id ? data : p)) : [...people, { ...data, id: uid() }];
    persistPeople(next); setPatientForm(null); flash("Paciente cadastrado.");
  };
  const weekShift = (dir) => { const d = parseKey(selected); d.setDate(d.getDate() + dir * (weekSpan >= 7 ? 7 : weekSpan)); setSelected(keyOf(d)); setCursor({ y: d.getFullYear(), m: d.getMonth() }); };
  // Correcao em lote das consultas que ficaram concluidas com saldo em aberto.
  const corrigirStatus = async (ids) => {
    const alvo = new Set(ids);
    const next = items.map((it) => (alvo.has(it.id) ? { ...it, status: "confirmado" } : it));
    setItems(next);
    try { await store.set(STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
    flash(`${ids.length} ${ids.length === 1 ? "consulta corrigida" : "consultas corrigidas"}.`);
  };
  const persistChamadas = async (next) => { setChamadas(next); try { await store.set(CHAMADAS_KEY, JSON.stringify(next)); } catch (_) {} };
  // "ref" guarda a consulta que gerou o prazo: se a pessoa fizer procedimento
  // novo, a marca antiga deixa de valer e ela volta para a fila sozinha.
  const marcarChamado = (chave, ref) => persistChamadas({ ...chamadas, [chave]: { em: todayKey(), ref } });
  const desfazerChamado = (chave) => { const next = { ...chamadas }; delete next[chave]; persistChamadas(next); };
  const persistProcs = async (next) => { setProcs(next); try { await store.set(PROCS_KEY, JSON.stringify(next)); } catch (_) {} };
  // Renomear no cadastro tem que renomear nas consultas ja salvas, senao elas
  // viram "fora do cadastro" e somem da contagem.
  const renameProc = async (antigo, novo) => {
    if (!antigo || !novo || antigo === novo) return;
    const troca = (x) => (x === antigo ? novo : x);
    const next = items.map((it) => ({
      ...it,
      procedure: troca(it.procedure),
      procedures: (it.procedures || []).map(troca),
    }));
    setItems(next);
    try { await store.set(STORAGE_KEY, JSON.stringify(next)); } catch (_) {}
  };
  const persistEstoque = async (next) => { setEstoque(next); try { await store.set(STOCK_KEY, JSON.stringify(next)); } catch (_) {} };
  const addEstoque = (it) => persistEstoque([...estoque, { ...it, id: uid() }]);
  const setEstoqueQtd = (id, qtd) => persistEstoque(estoque.map((i) => (i.id === id ? { ...i, qtd: Math.max(0, qtd) } : i)));
  const delEstoque = (id) => persistEstoque(estoque.filter((i) => i.id !== id));
  const saveEstoqueItem = (data) => { persistEstoque(estoque.map((i) => (i.id === data.id ? data : i))); setEstoqueForm(null); };
  const login = async (email, senha) => {
    try { const cred = await signInWithEmailAndPassword(fbAuth, (email || "").trim(), senha); setAuth(cred.user.email); return true; }
    catch (_) { return false; }
  };
  const logout = async () => { await signOut(fbAuth); setAuth(null); };
  useEffect(() => {
    const unsub = onAuthStateChanged(fbAuth, (u) => { setAuth(u ? u.email : null); setAuthReady(true); });
    return () => unsub();
  }, []);

  const countByDate = useMemo(() => {
    const m = {};
    for (const it of items) if (it.status !== "cancelado") m[it.date] = (m[it.date] || 0) + 1;
    return m;
  }, [items]);

  const dayList = useMemo(
    () => items.filter((it) => it.date === selected).sort((a, b) => a.time.localeCompare(b.time)),
    [items, selected]
  );

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || view !== "agenda") return null;
    return items
      .filter((it) => it.patient.toLowerCase().includes(q) || (it.phone || "").includes(q) || igHandle(it.instagram).toLowerCase().includes(q))
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [items, query, view]);

  const grid = useMemo(() => {
    const start = new Date(cursor.y, cursor.m, 1).getDay();
    const total = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < start; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(keyOf(new Date(cursor.y, cursor.m, d)));
    return cells;
  }, [cursor]);

  const shiftMonth = (dir) => { const d = new Date(cursor.y, cursor.m + dir, 1); setCursor({ y: d.getFullYear(), m: d.getMonth() }); };

  const TABS = [
    { id: "agenda", label: "Agenda", icon: CalendarDays },
    { id: "pacientes", label: "Pacientes", icon: Users },
    { id: "retornos", label: "Retornos", icon: RotateCcw },
    { id: "chamar", label: "Chamar", icon: PhoneCall },
    { id: "pagamentos", label: "Pagamentos", icon: Wallet },
    { id: "faturamento", label: "Faturamento", icon: TrendingUp },
    { id: "estoque", label: "Estoque", icon: Package },
    { id: "procedimentos", label: "Procedimentos", icon: ClipboardList },
    { id: "exportar", label: "Exportar", icon: FileSpreadsheet },
  ];

  // Espera so a sessao resolver (rapido, e local). Os dados NAO seguram mais a
  // tela: a interface aparece na hora e o conteudo entra quando chega.
  if (!authReady) return (
    <div className="ff-b" style={{ minHeight: "100vh", background: C.ink, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
      <div className="text-sm" style={{ opacity: 0.7 }}>Carregando…</div>
    </div>
  );
  if (!auth) return <LoginScreen onLogin={login} />;

  return (
    <div className="ff-b min-h-screen w-full" style={{ background: C.bg, color: C.ink }}>
      <header style={{ background: C.ink }}>
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center gap-3">
          <div className="leading-none text-white shrink-0">
            <div className="ff-b" style={{ fontSize: 8, letterSpacing: 3, opacity: 0.6 }}>MENTORIA</div>
            <div className="ff-serif" style={{ fontSize: 19, lineHeight: 1.05 }}>Harmonização Facial</div>
            <div className="ff-b" style={{ fontSize: 7, letterSpacing: 3, opacity: 0.5, marginTop: 1 }}>FULL FACE · IMERSÃO</div>
          </div>
          {view !== "faturamento" && (
            <div className="flex-1 max-w-xs ml-auto relative">
              <Search size={15} color="#9E98A4" style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)" }} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar paciente…"
                     className="w-full text-sm rounded-lg py-2 pl-8 pr-3"
                     style={{ background: "#3A363F", color: "#fff", border: "1px solid #FFFFFF1F" }} />
              {query && (
                <button onClick={() => setQuery("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}>
                  <X size={15} color="#9E98A4" />
                </button>
              )}
            </div>
          )}
          <button onClick={openNew} className={`flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 font-medium shrink-0 ${view === "faturamento" ? "ml-auto" : ""}`}
                  style={{ background: "#fff", color: C.ink }}>
            <Plus size={16} /> <span className="hidden sm:inline">Nova consulta</span>
          </button>
          <button onClick={logout} className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#3A363F" }} title="Sair">
            <LogOut size={16} color="#9E98A4" />
          </button>
        </div>
      </header>

      {/* Menu de navegação */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.line}` }}>
        <div className="max-w-5xl mx-auto px-3 flex gap-1 overflow-x-auto ag-nav">
          {TABS.map((t) => {
            const on = view === t.id; const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => goView(t.id)}
                      className="flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap"
                      style={{ color: on ? C.ink : C.muted, fontWeight: on ? 600 : 500,
                               borderBottom: `2px solid ${on ? C.coral : "transparent"}` }}>
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-5 py-6">
        {loading ? (
          <div className="text-center py-24 text-sm" style={{ color: C.muted }}>Carregando…</div>
        ) : view === "agenda" ? (
          searchResults ? (
            <SearchView results={searchResults} onOpen={(it) => setModal(it)}
                        onPick={(k) => { setQuery(""); setSelected(k); setCursor({ y: parseKey(k).getFullYear(), m: parseKey(k).getMonth() }); }} />
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex rounded-lg p-0.5" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                  {[["dia", "Dia", CalendarDays], ["semana", "Semana", Calendar]].map(([k, l, Ic]) => (
                    <button key={k} onClick={() => setAgendaView(k)} className="flex items-center gap-1.5 text-xs rounded-md px-3.5 py-1.5 font-medium"
                            style={{ background: agendaView === k ? C.ink : "transparent", color: agendaView === k ? "#fff" : C.muted }}>
                      <Ic size={13} /> {l}
                    </button>
                  ))}
                </div>
                {agendaView === "semana" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex rounded-lg p-0.5" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                      {[[3, "3 dias"], [7, "7 dias"]].map(([v, l]) => (
                        <button key={v} onClick={() => setWeekSpan(v)} className="text-xs rounded-md px-3 py-1.5 font-medium"
                                style={{ background: weekSpan === v ? C.ink : "transparent", color: weekSpan === v ? "#fff" : C.muted }}>{l}</button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <IconBtn onClick={() => weekShift(-1)}><ChevronLeft size={17} /></IconBtn>
                      <div className="text-sm font-medium capitalize" style={{ color: C.ink, minWidth: 120, textAlign: "center" }}>{weekLabel(selected, weekSpan)}</div>
                      <IconBtn onClick={() => weekShift(1)}><ChevronRight size={17} /></IconBtn>
                    </div>
                  </div>
                )}
              </div>

              {agendaView === "semana" ? (
                <WeekView selected={selected} span={weekSpan} items={items} onOpen={(it) => setModal(it)} onDay={(k) => { setSelected(k); setAgendaView("dia"); }} />
              ) : (
              <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0,340px) minmax(0,1fr)" }}>
              <section className="rounded-2xl p-4 h-fit" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="ff-d text-base" style={{ fontWeight: 600 }}>
                    {MESES[cursor.m]} <span style={{ color: C.faint }}>{cursor.y}</span>
                  </div>
                  <div className="flex gap-1">
                    <IconBtn onClick={() => shiftMonth(-1)}><ChevronLeft size={17} /></IconBtn>
                    <IconBtn onClick={() => shiftMonth(1)}><ChevronRight size={17} /></IconBtn>
                  </div>
                </div>
                <div className="grid grid-cols-7 mb-1">
                  {DIAS.map((d) => <div key={d} className="text-center text-xs py-1" style={{ color: C.faint, fontWeight: 500 }}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {grid.map((k, i) => {
                    if (!k) return <div key={i} />;
                    const isSel = k === selected, isToday = k === todayKey(), n = countByDate[k] || 0;
                    return (
                      <button key={k} onClick={() => setSelected(k)}
                              className="relative aspect-square rounded-lg flex flex-col items-center justify-center text-sm"
                              style={{ background: isSel ? C.ink : "transparent", color: isSel ? "#fff" : C.ink,
                                       fontWeight: isSel || isToday ? 600 : 400,
                                       border: isToday && !isSel ? `1.5px solid ${C.coral}` : "1.5px solid transparent" }}>
                        {parseKey(k).getDate()}
                        {n > 0 && (
                          <span className="absolute" style={{ bottom: 5, display: "flex", gap: 2 }}>
                            {Array.from({ length: Math.min(n, 3) }).map((_, j) => (
                              <span key={j} style={{ width: 4, height: 4, borderRadius: 4, background: isSel ? "#fff" : C.coral }} />
                            ))}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => { const t = todayKey(); setSelected(t); setCursor({ y: now.getFullYear(), m: now.getMonth() }); }}
                        className="w-full mt-3 text-sm rounded-lg py-2 font-medium flex items-center justify-center gap-1.5"
                        style={{ background: C.tealSoft, color: C.teal }}>
                  <CalendarDays size={15} /> Hoje
                </button>
              </section>

              <section>
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="ff-d text-xl capitalize" style={{ fontWeight: 600 }}>{prettyDate(selected)}</div>
                    <div className="text-sm" style={{ color: C.muted }}>
                      {dayList.filter((d) => d.status !== "cancelado").length} consulta(s)
                    </div>
                  </div>
                </div>

                {dayList.length > 0 && (
                  <div className="flex justify-end mb-3">
                    <div className="flex rounded-lg p-0.5" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                      {[["lista", "Lista", List], ["grade", "Horários", Clock]].map(([k, l, Ic]) => (
                        <button key={k} onClick={() => setDayMode(k)} className="flex items-center gap-1.5 text-xs rounded-md px-3 py-1.5 font-medium"
                                style={{ background: dayMode === k ? C.surface : "transparent", color: dayMode === k ? C.ink : C.muted,
                                         boxShadow: dayMode === k ? "0 1px 2px #0000000f" : "none" }}>
                          <Ic size={13} /> {l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {dayList.length === 0 ? (
                  <EmptyBlock icon={Calendar} title="Dia livre" text="Nenhuma consulta marcada para este dia.">
                    <button onClick={openNew} className="text-sm rounded-lg px-4 py-2 font-medium mt-4" style={{ background: C.ink, color: "#fff" }}>
                      Agendar consulta
                    </button>
                  </EmptyBlock>
                ) : dayMode === "grade" ? (
                  <DayTimeline dayList={dayList} onOpen={(it) => setModal(it)} />
                ) : (
                  <div className="space-y-2.5">
                    {dayList.map((it) => (
                      <Card key={it.id} it={it} onEdit={() => setModal(it)} onDelete={() => remove(it.id)} onStatus={setStatus} />
                    ))}
                  </div>
                )}
              </section>
              </div>
              )}

              <NotasCard notas={notas} onAdd={addNota} onToggle={toggleNota} onDel={delNota} />
            </div>
          )
        ) : view === "pacientes" ? (
          <PatientsView items={items} people={people} query={query} onAgendar={openNewFor} onHistory={openHistory} onCadastrar={() => setPatientForm({})} />
        ) : view === "retornos" ? (
          <RetornosView items={items} onAgendar={openNewFor} onHistory={openHistory} />
        ) : view === "chamar" ? (
          <ChamarView items={items} chamadas={chamadas} onChamar={marcarChamado}
                     onDesfazer={desfazerChamado} onAgendar={openNewFor} onHistory={openHistory} />
        ) : view === "pagamentos" ? (
          <PaymentsView items={items} query={query} onEdit={setModal} onCorrigirStatus={corrigirStatus} />
        ) : view === "estoque" ? (
          <EstoqueView estoque={estoque} onAdd={addEstoque} onSet={setEstoqueQtd} onDel={delEstoque} onEdit={setEstoqueForm} />
        ) : view === "procedimentos" ? (
          <Suspense fallback={<div className="text-center py-24 text-sm" style={{ color: C.muted }}>Carregando…</div>}>
            <ProcedimentosView items={items} procs={procs} onSaveProcs={persistProcs}
                              onRename={renameProc} C={C} />
          </Suspense>
        ) : view === "exportar" ? (
          <Suspense fallback={<div className="text-center py-24 text-sm" style={{ color: C.muted }}>Carregando…</div>}>
            <ExportView items={items} estoque={estoque} C={C} />
          </Suspense>
        ) : (
          <BillingView items={items} />
        )}
      </main>

      {modal && (
        <FormModal initial={modal} procs={procs} pacientes={derivePatients(items, people)} onClose={() => setModal(null)} onSave={save}
                   onDelete={modal.id ? () => { remove(modal.id); setModal(null); } : null} />
      )}

      {historyPatient && (
        <PatientHistory name={historyPatient} items={items} onClose={() => setHistoryPatient(null)}
                        onAgendar={(p) => { setHistoryPatient(null); openNewFor(p); }}
                        onOpenConsulta={(it) => { setHistoryPatient(null); setModal(it); }} />
      )}

      {patientForm && <PatientFormModal initial={patientForm} onClose={() => setPatientForm(null)} onSave={savePerson} />}

      {estoqueForm && <EstoqueFormModal initial={estoqueForm} onClose={() => setEstoqueForm(null)} onSave={saveEstoqueItem} />}

      {toast && (
        <div className="ag-pop" style={{ position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)",
             background: C.ink, color: "#fff", padding: "10px 18px", borderRadius: 12, fontSize: 14,
             boxShadow: "0 8px 30px #0003", zIndex: 60 }}>{toast}</div>
      )}
    </div>
  );
}

// ---- UI compartilhada ------------------------------------------------------
function IconBtn({ children, onClick }) {
  return (
    <button onClick={onClick} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg, color: C.ink }}>
      {children}
    </button>
  );
}

function EmptyBlock({ icon: Icon, title, text, children }) {
  return (
    <div className="rounded-2xl px-6 py-14 text-center ag-fade" style={{ background: C.surface, border: `1px dashed ${C.line}` }}>
      <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: C.tealSoft }}>
        <Icon size={22} color={C.teal} />
      </div>
      <div className="ff-d text-base mb-1" style={{ fontWeight: 600 }}>{title}</div>
      <div className="text-sm" style={{ color: C.muted }}>{text}</div>
      {children}
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const map = { coral: C.coral, good: C.goodFg, ink: C.ink, teal: C.teal };
  return (
    <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <div className="text-xs mb-1" style={{ color: C.muted }}>{label}</div>
      <div className="ff-d text-xl" style={{ fontWeight: 700, color: map[tone] || C.ink }}>{value}</div>
    </div>
  );
}

function StatusPill({ status, onChange }) {
  const s = STATUS[status] || STATUS.pendente;
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: s.bg, color: s.fg }}>
        <span style={{ width: 6, height: 6, borderRadius: 6, background: s.dot }} /> {s.label}
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 20 }} onClick={() => setOpen(false)} />
          <div className="ag-pop absolute right-0 mt-1 rounded-xl py-1 z-30"
               style={{ background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 10px 30px #0002", minWidth: 150 }}>
            {Object.entries(STATUS).map(([k, v]) => (
              <button key={k} onClick={() => { onChange(k); setOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left" style={{ color: C.ink }}>
                <span style={{ width: 7, height: 7, borderRadius: 7, background: v.dot }} /> {v.label}
                {k === status && <Check size={14} style={{ marginLeft: "auto" }} color={C.teal} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Card({ it, onEdit, onDelete, onStatus }) {
  const [confirm, setConfirm] = useState(false);
  const s = STATUS[it.status] || STATUS.pendente;
  const dim = it.status === "cancelado";
  const valor = toNum(it.valor), pago = totalPagoDe(it), saldo = valor - pago;

  return (
    <div className="ag-fade rounded-2xl p-4 flex gap-4 group"
         style={{ background: C.surface, border: `1px solid ${C.line}`, opacity: dim ? 0.62 : 1 }}>
      <div className="flex flex-col items-center pt-0.5 shrink-0" style={{ width: 60 }}>
        <div className="ff-d text-lg leading-none" style={{ fontWeight: 600, color: C.ink }}>{it.time}</div>
        {it.endTime && <div className="text-xs mt-1" style={{ color: C.faint }}>às {it.endTime}</div>}
        <div className="mt-2 rounded-full" style={{ width: 3, flex: 1, background: s.dot, minHeight: 14 }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate flex items-center gap-1.5" style={{ color: C.ink }}>
              <User size={14} color={C.faint} /> {it.patient}
            </div>
            {procsLabel(it) && <div className="text-sm mt-0.5 truncate" style={{ color: C.teal }}>{procsLabel(it)}</div>}
          </div>
          <StatusPill status={it.status} onChange={(v) => onStatus(it.id, v)} />
        </div>

        {it.aviso && (
          <div className="flex items-start gap-1.5 mt-2 text-xs rounded-lg px-2.5 py-1.5 font-medium"
               style={{ background: C.warnBg, color: C.warnFg, borderLeft: `3px solid ${C.warnFg}` }}>
            <AlertCircle size={13} style={{ marginTop: 1, flexShrink: 0 }} /> <span>{it.aviso}</span>
          </div>
        )}

        {(it.instagram || it.phone) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: C.muted }}>
            {it.instagram && <span className="flex items-center gap-1"><Instagram size={12} /> @{igHandle(it.instagram)}</span>}
            {it.phone && <span className="flex items-center gap-1"><Phone size={12} /> {it.phone}</span>}
          </div>
        )}

        {valor > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className="text-xs rounded-md px-2 py-1 font-medium" style={{ background: C.tealSoft, color: C.money }}>{brl(valor)}</span>
            {pago > 0 && <span className="text-xs rounded-md px-2 py-1" style={{ background: C.bg, color: C.muted }}>pago {brl(pago)}{pagResumo(it) ? ` · ${pagResumo(it)}` : ""}</span>}
            {saldo > 0 && <span className="text-xs rounded-md px-2 py-1" style={{ background: C.coralSoft, color: C.coral }}>resta {brl(saldo)}</span>}
            {saldo <= 0 && valor > 0 && <span className="text-xs rounded-md px-2 py-1 flex items-center gap-1" style={{ background: C.goodBg, color: C.goodFg }}><Check size={11} /> quitado</span>}
          </div>
        )}

        {it.notes && <div className="text-xs mt-2 rounded-lg px-2.5 py-1.5" style={{ background: C.bg, color: C.muted }}>{it.notes}</div>}

        <div className="flex items-center gap-1 mt-2.5">
          <button onClick={onEdit} className="flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 font-medium"
                  style={{ background: C.tealSoft, color: C.teal }}>
            <Pencil size={12} /> Editar
          </button>
          {confirm ? (
            <div className="flex items-center gap-1">
              <button onClick={onDelete} className="text-xs rounded-lg px-2.5 py-1.5 font-medium" style={{ background: C.coralSoft, color: C.coral }}>Confirmar exclusão</button>
              <button onClick={() => setConfirm(false)} className="text-xs rounded-lg px-2 py-1.5" style={{ color: C.muted }}>não</button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)} className="flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5" style={{ color: C.faint }}>
              <Trash2 size={12} /> Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchView({ results, onPick, onOpen }) {
  return (
    <div className="ag-fade">
      <div className="ff-d text-lg mb-3" style={{ fontWeight: 600 }}>{results.length} resultado(s)</div>
      {results.length === 0 ? (
        <div className="rounded-2xl px-6 py-12 text-center text-sm" style={{ background: C.surface, border: `1px dashed ${C.line}`, color: C.muted }}>
          Nenhum paciente encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {results.map((it) => {
            const s = STATUS[it.status] || STATUS.pendente;
            return (
              <div key={it.id} className="rounded-xl p-3.5 flex items-center gap-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <button onClick={() => onPick(it.date)} className="shrink-0 rounded-lg px-3 py-2 text-center" style={{ background: C.tealSoft }}>
                  <div className="text-xs" style={{ color: C.teal }}>{MESES[parseKey(it.date).getMonth()].slice(0, 3)}</div>
                  <div className="ff-d text-lg leading-none" style={{ fontWeight: 600, color: C.ink }}>{parseKey(it.date).getDate()}</div>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate" style={{ color: C.ink }}>{it.patient}</div>
                  <div className="text-xs truncate" style={{ color: C.muted }}>
                    {it.time}{it.endTime ? `–${it.endTime}` : ""} · {procsLabel(it) || "—"} {it.instagram ? `· @${igHandle(it.instagram)}` : ""} {toNum(it.valor) > 0 ? `· ${brl(it.valor)}` : ""}
                  </div>
                </div>
                <span className="text-xs rounded-full px-2.5 py-1 shrink-0" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
                <button onClick={() => onOpen(it)} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg }}>
                  <Pencil size={14} color={C.ink} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Pacientes -------------------------------------------------------------
function PatientsView({ items, people, query, onAgendar, onHistory, onCadastrar }) {
  const patients = useMemo(() => derivePatients(items, people), [items, people]);
  const q = query.trim().toLowerCase();
  const list = q ? patients.filter((p) => p.name.toLowerCase().includes(q) || (p.phone || "").includes(q) || (p.instagram || "").toLowerCase().includes(q)) : patients;

  if (patients.length === 0)
    return (
      <EmptyBlock icon={Users} title="Nenhum paciente ainda" text="Os pacientes aparecem aqui conforme você agenda consultas — ou cadastre um manualmente.">
        <button onClick={onCadastrar} className="text-sm rounded-lg px-4 py-2 font-medium mt-4" style={{ background: C.ink, color: "#fff" }}>Cadastrar paciente</button>
      </EmptyBlock>
    );

  return (
    <div className="ag-fade">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="ff-d text-xl" style={{ fontWeight: 600 }}>Pacientes</div>
        <div className="flex items-center gap-3">
          <div className="text-sm hidden sm:block" style={{ color: C.muted }}>{list.length} cadastrado(s)</div>
          <button onClick={onCadastrar} className="flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 font-medium" style={{ background: C.ink, color: "#fff" }}>
            <Plus size={15} /> Cadastrar
          </button>
        </div>
      </div>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
        {list.map((p) => (
          <div key={p.name} className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <button onClick={() => onHistory(p.name)} className="flex items-center gap-3 w-full text-left">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ff-d text-sm"
                   style={{ background: C.tealSoft, color: C.teal, fontWeight: 700 }}>{initials(p.name)}</div>
              <div className="min-w-0">
                <div className="font-semibold truncate" style={{ color: C.ink }}>{p.name}</div>
                <div className="text-xs truncate" style={{ color: C.muted }}>
                  {p.instagram ? "@" + p.instagram : ""}{p.instagram && p.phone ? " · " : ""}{p.phone || ""}
                  {!p.instagram && !p.phone ? "sem contato" : ""}
                </div>
              </div>
            </button>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-xs" style={{ color: C.muted }}>
              <span>{p.count} consulta(s)</span>
              {p.last && <span>última {shortDate(p.last)}</span>}
              {p.next && <span style={{ color: C.teal, fontWeight: 600 }}>próxima {shortDate(p.next)}</span>}
            </div>
            {p.aReceber > 0 && (
              <div className="text-xs mt-2 rounded-md px-2 py-1 inline-block" style={{ background: C.coralSoft, color: C.coral }}>
                a receber {brl(p.aReceber)}
              </div>
            )}
            <div className="flex gap-1.5 mt-3">
              <button onClick={() => onHistory(p.name)} className="flex-1 text-xs rounded-lg py-2 font-medium" style={{ background: C.tealSoft, color: C.teal }}>Histórico</button>
              <button onClick={() => onAgendar(p)} className="flex-1 text-xs rounded-lg py-2 font-medium" style={{ background: C.ink, color: "#fff" }}>Agendar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Pagamentos ------------------------------------------------------------
function PaymentsView({ items, query, onEdit, onCorrigirStatus }) {
  const [filtro, setFiltro] = useState("aReceber");
  const [revisando, setRevisando] = useState(false);
  const [marcadas, setMarcadas] = useState({});

  // Consultas que ficaram "Concluido" com saldo em aberto. Vinha do bug em que
  // escolher a conta do pagamento concluia a consulta mesmo com sinal parcial.
  const inconsistentes = useMemo(
    () => items.filter((it) => it.status === "concluido" && valorDe(it) > 0 && saldoDe(it) > 0)
               .sort((a, b) => (b.date + (b.time || "")).localeCompare(a.date + (a.time || ""))),
    [items]
  );
  const abrirRevisao = () => {
    const m = {};
    for (const it of inconsistentes) m[it.id] = true; // todas marcadas por padrao
    setMarcadas(m);
    setRevisando(true);
  };
  const aplicar = () => {
    const ids = inconsistentes.filter((it) => marcadas[it.id]).map((it) => it.id);
    if (ids.length) onCorrigirStatus(ids);
    setRevisando(false);
  };
  const qtdMarcadas = inconsistentes.filter((it) => marcadas[it.id]).length;
  const q = query.trim().toLowerCase();
  const withValue = useMemo(
    () => items.filter((it) => it.status !== "cancelado" && valorDe(it) > 0).sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [items]
  );
  const totalReceber = withValue.reduce((s, it) => s + saldoDe(it), 0);
  const totalRecebido = withValue.reduce((s, it) => s + recebidoDe(it), 0);

  let list = withValue;
  if (filtro === "aReceber") list = list.filter((it) => saldoDe(it) > 0);
  if (filtro === "quitados") list = list.filter((it) => saldoDe(it) <= 0);
  if (q) list = list.filter((it) => it.patient.toLowerCase().includes(q));

  return (
    <div className="ag-fade">
      <div className="ff-d text-xl mb-3" style={{ fontWeight: 600 }}>Pagamentos</div>

      {inconsistentes.length > 0 && !revisando && (
        <div className="rounded-2xl p-3.5 mb-4" style={{ background: C.coralSoft, border: `1px solid ${C.coral}33` }}>
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" style={{ color: C.coral }} />
            <div className="flex-1">
              <div className="text-sm font-medium" style={{ color: C.coral }}>
                {inconsistentes.length} {inconsistentes.length === 1 ? "consulta está concluída" : "consultas estão concluídas"} com saldo em aberto
              </div>
              <div className="text-xs mt-1" style={{ color: C.muted }}>
                Provavelmente ficaram assim por causa do sinal, que antes concluía a consulta sozinho.
              </div>
              <button onClick={abrirRevisao} className="text-xs rounded-lg px-3 py-1.5 font-medium mt-2.5"
                      style={{ background: C.coral, color: "#fff" }}>
                Revisar {inconsistentes.length === 1 ? "" : "as " + inconsistentes.length}
              </button>
            </div>
          </div>
        </div>
      )}

      {revisando && (
        <div className="rounded-2xl mb-4" style={{ background: C.surface, border: `1px solid ${C.line}`, overflow: "hidden" }}>
          <div className="p-3.5" style={{ borderBottom: `1px solid ${C.line}` }}>
            <div className="text-sm font-medium" style={{ color: C.ink }}>Voltar para Confirmado</div>
            <div className="text-xs mt-1" style={{ color: C.muted }}>
              Desmarque as que realmente foram concluídas mesmo com valor em aberto.
            </div>
          </div>
          <div style={{ maxHeight: 300, overflowY: "auto" }} className="ag-scroll">
            {inconsistentes.map((it) => (
              <label key={it.id} className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer"
                     style={{ borderBottom: `1px solid ${C.line}` }}>
                <input type="checkbox" checked={!!marcadas[it.id]}
                       onChange={() => setMarcadas((p) => ({ ...p, [it.id]: !p[it.id] }))}
                       style={{ accentColor: C.coral, width: 16, height: 16 }} />
                <span className="flex-1 min-w-0">
                  <span className="text-sm block truncate" style={{ color: C.ink }}>{it.patient}</span>
                  <span className="text-xs" style={{ color: C.muted }}>
                    {shortDate(it.date)} · {brl(it.valor)} · pago {brl(totalPagoDe(it))} · falta {brl(saldoDe(it))}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="p-3 flex gap-2">
            <button onClick={() => setRevisando(false)} className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                    style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}>Cancelar</button>
            <button onClick={aplicar} disabled={qtdMarcadas === 0} className="flex-1 rounded-xl py-2.5 text-sm font-medium"
                    style={{ background: qtdMarcadas === 0 ? C.line : C.ink, color: qtdMarcadas === 0 ? C.muted : "#fff" }}>
              Corrigir {qtdMarcadas || ""}
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="A receber" value={brl(totalReceber)} tone="coral" />
        <StatCard label="Já recebido" value={brl(totalRecebido)} tone="good" />
      </div>
      <div className="flex gap-1.5 mb-3">
        {[["aReceber", "A receber"], ["quitados", "Quitados"], ["todos", "Todos"]].map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className="text-xs rounded-full px-3 py-1.5 font-medium"
                  style={{ background: filtro === k ? C.ink : C.surface, color: filtro === k ? "#fff" : C.muted, border: `1px solid ${filtro === k ? C.ink : C.line}` }}>{l}</button>
        ))}
      </div>
      {list.length === 0 ? (
        <EmptyBlock icon={Wallet} title="Nada por aqui" text="Nenhuma consulta com valor neste filtro." />
      ) : (
        <div className="space-y-2">
          {list.map((it) => {
            const saldo = saldoDe(it); const quit = saldo <= 0;
            return (
              <button key={it.id} onClick={() => onEdit(it)} className="w-full text-left rounded-xl p-3.5 flex items-center gap-3"
                      style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <div className="shrink-0 rounded-lg px-3 py-2 text-center" style={{ background: C.bg }}>
                  <div className="text-xs" style={{ color: C.muted }}>{MESES[parseKey(it.date).getMonth()].slice(0, 3)}</div>
                  <div className="ff-d text-lg leading-none" style={{ fontWeight: 600, color: C.ink }}>{parseKey(it.date).getDate()}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate" style={{ color: C.ink }}>{it.patient}</div>
                  <div className="text-xs truncate" style={{ color: C.muted }}>{procsLabel(it) || "—"} · {brl(it.valor)}{totalPagoDe(it) > 0 ? ` · pago ${brl(totalPagoDe(it))}` : ""}{pagResumo(it) ? ` (${pagResumo(it)})` : ""}</div>
                </div>
                {quit ? (
                  <span className="text-xs rounded-full px-2.5 py-1 shrink-0 flex items-center gap-1" style={{ background: C.goodBg, color: C.goodFg }}><Check size={11} /> quitado</span>
                ) : (
                  <span className="text-xs rounded-full px-2.5 py-1 shrink-0" style={{ background: C.coralSoft, color: C.coral }}>resta {brl(saldo)}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Faturamento -----------------------------------------------------------
function BillingView({ items }) {
  const now = new Date();
  const [ym, setYm] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
  const shift = (dir) => { const [y, m] = ym.split("-").map(Number); const d = new Date(y, m - 1 + dir, 1); setYm(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); };
  const stats = useMemo(() => billingForMonth(items, ym), [items, ym]);
  const chart = useMemo(() => last6Months(items, ym), [items, ym]);
  const procs = useMemo(() => topProcs(items, ym), [items, ym]);
  const porConta = useMemo(() => {
    const list = items.filter((it) => ymOf(it.date) === ym && it.status !== "cancelado");
    const map = {};
    for (const it of list) {
      for (const p of pagList(it)) {
        const rec = toNum(p.valor);
        if (rec <= 0) continue;
        const conta = p.conta || "Sem conta";
        const via = p.forma || "Outro";
        if (!map[conta]) map[conta] = { total: 0, vias: {} };
        map[conta].total += rec;
        map[conta].vias[via] = (map[conta].vias[via] || 0) + rec;
      }
    }
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [items, ym]);
  const [Y, M] = ym.split("-").map(Number);

  return (
    <div className="ag-fade">
      <div className="flex items-center justify-between mb-4">
        <div className="ff-d text-xl" style={{ fontWeight: 600 }}>Faturamento</div>
        <div className="flex items-center gap-2">
          <IconBtn onClick={() => shift(-1)}><ChevronLeft size={17} /></IconBtn>
          <div className="text-sm font-medium capitalize" style={{ color: C.ink, minWidth: 116, textAlign: "center" }}>{MESES[M - 1]} {Y}</div>
          <IconBtn onClick={() => shift(1)}><ChevronRight size={17} /></IconBtn>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="Faturado" value={brl(stats.faturado)} tone="ink" />
        <StatCard label="Recebido" value={brl(stats.recebido)} tone="good" />
        <StatCard label="A receber" value={brl(stats.aReceber)} tone="coral" />
        <StatCard label="Atendimentos" value={String(stats.atend)} tone="teal" />
      </div>

      <div className="rounded-2xl p-4 mb-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <div className="text-sm font-medium mb-3" style={{ color: C.ink }}>Faturamento — últimos 6 meses</div>
        <div style={{ width: "100%", height: 200 }}>
          <Suspense fallback={<div className="h-full flex items-center justify-center text-xs" style={{ color: C.muted }}>Carregando gráfico…</div>}>
            <FaturamentoChart data={chart} C={C} brl={brl} />
          </Suspense>
        </div>
      </div>

      {porConta.length > 0 && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <div className="text-sm font-medium mb-3" style={{ color: C.ink }}>Recebido por conta</div>
          <div className="space-y-3">
            {porConta.map(([conta, d]) => (
              <div key={conta} className="pb-3" style={{ borderBottom: `1px solid ${C.line}` }}>
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold" style={{ color: C.ink }}>{conta}</span>
                  <span className="ff-d" style={{ fontWeight: 700, color: C.ink }}>{brl(d.total)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {Object.entries(d.vias).map(([via, v]) => (
                    <span key={via} className="text-xs rounded-md px-2 py-1" style={{ background: C.tealSoft, color: C.teal }}>{via} · {brl(v)}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {procs.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <div className="text-sm font-medium mb-3" style={{ color: C.ink }}>Procedimentos do mês</div>
          <div className="space-y-2.5">
            {procs.map(([name, val]) => {
              const pct = stats.faturado ? Math.round((val / stats.faturado) * 100) : 0;
              return (
                <div key={name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span style={{ color: C.ink }}>{name}</span>
                    <span style={{ color: C.muted }}>{brl(val)}</span>
                  </div>
                  <div className="rounded-full" style={{ height: 6, background: C.bg }}>
                    <div className="rounded-full" style={{ height: 6, width: `${pct}%`, background: C.coral }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Grade de horários do dia (mostra atendimentos simultâneos lado a lado) --
function layoutDay(events) {
  const evs = events.slice().sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
  const out = [];
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const cols = [];
    cluster.forEach((ev) => {
      let placed = false;
      for (let ci = 0; ci < cols.length; ci++) {
        if (cols[ci] <= ev.startMin) { ev._col = ci; cols[ci] = ev.endMin; placed = true; break; }
      }
      if (!placed) { ev._col = cols.length; cols.push(ev.endMin); }
    });
    cluster.forEach((ev) => { ev._cols = cols.length; out.push(ev); });
    cluster = []; clusterEnd = -1;
  };
  evs.forEach((ev) => {
    if (cluster.length && ev.startMin >= clusterEnd) flush();
    cluster.push(ev); clusterEnd = Math.max(clusterEnd, ev.endMin);
  });
  flush();
  return out;
}

function DayTimeline({ dayList, onOpen }) {
  const HOUR_PX = 66, GUTTER = 52;
  const COLBG = ["#E4EFF9", "#FBE7F0", "#E7F3EA", "#FBF0D8"];
  const evs = dayList.map((it) => {
    const [sh, sm] = it.time.split(":").map(Number);
    const startMin = sh * 60 + sm;
    let endMin = startMin + 60;
    if (it.endTime) { const [eh, em] = it.endTime.split(":").map(Number); endMin = eh * 60 + em; }
    if (endMin <= startMin) endMin = startMin + 30;
    return { ...it, startMin, endMin };
  });
  if (evs.length === 0) return <EmptyBlock icon={Calendar} title="Dia livre" text="Nenhuma consulta marcada para este dia." />;

  const minStart = Math.min(...evs.map((e) => e.startMin));
  const maxEnd = Math.max(...evs.map((e) => e.endMin));
  const startHour = Math.min(8, Math.floor(minStart / 60));
  const endHour = Math.max(19, Math.ceil(maxEnd / 60));
  const rangeStart = startHour * 60;
  const totalMin = (endHour - startHour) * 60;
  const PPM = HOUR_PX / 60;
  const laid = layoutDay(evs);
  const hours = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);

  return (
    <div className="ag-fade rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <div style={{ position: "relative", height: totalMin * PPM + 8 }}>
        {hours.map((h) => {
          const top = (h * 60 - rangeStart) * PPM;
          return (
            <div key={h} style={{ position: "absolute", top, left: 0, right: 0 }}>
              <div style={{ position: "absolute", left: 0, top: -7, width: GUTTER - 10, textAlign: "right", fontSize: 11, color: C.faint }}>{pad(h)}:00</div>
              <div style={{ position: "absolute", left: GUTTER, right: 0, top: 0, borderTop: `1px solid ${C.line}` }} />
            </div>
          );
        })}
        <div style={{ position: "absolute", left: GUTTER, right: 0, top: 0, bottom: 0 }}>
          {laid.map((ev) => {
            const s = STATUS[ev.status] || STATUS.pendente;
            const top = (ev.startMin - rangeStart) * PPM;
            const height = Math.max((ev.endMin - ev.startMin) * PPM - 3, 30);
            const widthPct = 100 / ev._cols;
            const leftPct = ev._col * widthPct;
            const cancel = ev.status === "cancelado";
            return (
              <button key={ev.id} onClick={() => onOpen(ev)}
                      style={{ position: "absolute", top, height, left: `calc(${leftPct}% + 2px)`, width: `calc(${widthPct}% - 4px)`,
                               background: COLBG[ev._col % COLBG.length], borderLeft: `3px solid ${s.dot}`, borderRadius: 8, padding: "4px 7px",
                               overflow: "hidden", textAlign: "left", opacity: cancel ? 0.55 : 1 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.ink, opacity: 0.7, lineHeight: 1.15 }}>{ev.time}{ev.endTime ? `–${ev.endTime}` : ""}</div>
                <div className="truncate" style={{ fontSize: 12, fontWeight: 600, color: C.ink, lineHeight: 1.25 }}>{ev.patient}</div>
                {height > 46 && procsLabel(ev) && <div className="truncate" style={{ fontSize: 11, color: C.muted, lineHeight: 1.2 }}>{procsLabel(ev)}</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---- Retornos (botox e combos de harmonização) -----------------------------
function RetornosView({ items, onAgendar, onHistory }) {
  const [filtro, setFiltro] = useState("todos");
  const pacientes = useMemo(() => deriveRetornos(items), [items]);
  const list = pacientes.filter((p) => (filtro === "todos" ? (p.botox || p.harmo) : filtro === "botox" ? p.botox : p.harmo));
  const relDate = (p) => {
    if (filtro === "botox") return p.botox && p.botox.date;
    if (filtro === "harmo") return p.harmo && p.harmo.date;
    const ds = [p.botox && p.botox.date, p.harmo && p.harmo.date].filter(Boolean).sort();
    return ds[ds.length - 1];
  };
  list.sort((a, b) => (relDate(a) || "").localeCompare(relDate(b) || ""));

  if (pacientes.length === 0)
    return <EmptyBlock icon={RotateCcw} title="Sem retornos ainda" text="Aqui aparecem os pacientes que fizeram botox ou combos de harmonização, para você agendar o retorno." />;

  return (
    <div className="ag-fade">
      <div className="flex items-center justify-between mb-3">
        <div className="ff-d text-xl" style={{ fontWeight: 600 }}>Retornos</div>
        <div className="text-sm" style={{ color: C.muted }}>{list.length} paciente(s)</div>
      </div>
      <div className="flex gap-1.5 mb-4">
        {[["todos", "Todos"], ["botox", "Botox"], ["harmo", "Harmonização"]].map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className="text-xs rounded-full px-3 py-1.5 font-medium"
                  style={{ background: filtro === k ? C.ink : C.surface, color: filtro === k ? "#fff" : C.muted, border: `1px solid ${filtro === k ? C.ink : C.line}` }}>{l}</button>
        ))}
      </div>
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))" }}>
        {list.map((p) => {
          const showBotox = (filtro === "todos" || filtro === "botox") && p.botox;
          const showHarmo = (filtro === "todos" || filtro === "harmo") && p.harmo;
          const dueBotox = p.botox && daysSince(p.botox.date) >= 120;
          const dueHarmo = p.harmo && daysSince(p.harmo.date) >= 180;
          const due = (showBotox && dueBotox) || (showHarmo && dueHarmo);
          return (
            <div key={p.name} className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${due ? C.coral : C.line}` }}>
              <button onClick={() => onHistory(p.name)} className="flex items-center gap-3 w-full text-left">
                <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ff-d text-sm"
                     style={{ background: C.tealSoft, color: C.teal, fontWeight: 700 }}>{initials(p.name)}</div>
                <div className="min-w-0">
                  <div className="font-semibold truncate" style={{ color: C.ink }}>{p.name}</div>
                  <div className="text-xs truncate" style={{ color: C.muted }}>
                    {p.instagram ? "@" + p.instagram : ""}{p.instagram && p.phone ? " · " : ""}{p.phone || ""}{!p.instagram && !p.phone ? "sem contato" : ""}
                  </div>
                </div>
              </button>
              <div className="mt-3 space-y-1.5">
                {showBotox && (
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: C.ink }}>Botox</span>
                    <span style={{ color: dueBotox ? C.coral : C.muted, fontWeight: dueBotox ? 600 : 400 }}>{humanAgo(p.botox.date)} · {shortDate(p.botox.date)}</span>
                  </div>
                )}
                {showHarmo && (
                  <div className="flex items-center justify-between text-xs">
                    <span style={{ color: C.ink }}>Harmonização</span>
                    <span style={{ color: dueHarmo ? C.coral : C.muted, fontWeight: dueHarmo ? 600 : 400 }}>{humanAgo(p.harmo.date)} · {shortDate(p.harmo.date)}</span>
                  </div>
                )}
              </div>
              {due && (
                <div className="text-xs mt-2 rounded-md px-2 py-1 inline-flex items-center gap-1" style={{ background: C.coralSoft, color: C.coral }}>
                  <RotateCcw size={11} /> retorno recomendado
                </div>
              )}
              <button onClick={() => onAgendar(p)} className="w-full text-xs rounded-lg py-2 font-medium mt-3" style={{ background: C.ink, color: "#fff" }}>
                Agendar retorno
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- Chamar de volta (recontato por tempo) ---------------------------------
function ChamarView({ items, chamadas, onChamar, onDesfazer, onHistory, onAgendar }) {
  const [filtro, setFiltro] = useState("todos");
  const chaveDe = (nome, cat) => `${normNome(nome)}|${cat}`;
  // A marca so vale para a consulta que gerou o prazo (ref). Procedimento novo
  // muda a ref e a pessoa volta para a fila automaticamente.
  const jaChamado = (nome, e) => {
    const r = (chamadas || {})[chaveDe(nome, e.cat)];
    return r && r.ref === e.date ? r : null;
  };
  const lista = useMemo(() => deriveChamar(items), [items]);
  const filt = lista.filter((m) => (filtro === "todos" ? true : m.cats[filtro]));
  const pick = (m) => (filtro !== "todos" ? m.entries.find((x) => x.cat === filtro) : m.urgente);

  // Agrupa pela data de chamar: primeiro quem ja passou do prazo, depois mes a mes.
  const grupos = useMemo(() => {
    const g = {};
    for (const m of filt) {
      const e = pick(m);
      if (!e) continue;
      const marca = jaChamado(m.name, e);
      const chave = marca ? "chamados" : (e.overdue ? "atrasados" : ymOf(e.chamarKey));
      if (!g[chave]) g[chave] = [];
      g[chave].push({ m, e, marca });
    }
    for (const k of Object.keys(g)) g[k].sort((a, b) => a.e.chamarKey.localeCompare(b.e.chamarKey));
    const peso = (k) => (k === "atrasados" ? 0 : k === "chamados" ? 2 : 1);
    const chaves = Object.keys(g).sort((a, b) => (peso(a) - peso(b)) || a.localeCompare(b));
    return chaves.map((k) => ({
      chave: k,
      titulo: k === "atrasados" ? "Passou do prazo" : k === "chamados" ? "Já chamados" : tituloMes(k),
      linhas: g[k],
    }));
  }, [filt, filtro, chamadas]);

  if (lista.length === 0)
    return <EmptyBlock icon={PhoneCall} title="Ninguém para chamar ainda" text="Conforme os pacientes fazem procedimentos, aparecem aqui no prazo de chamar de volta." />;

  return (
    <div className="ag-fade">
      <div className="flex items-center justify-between mb-3">
        <div className="ff-d text-xl" style={{ fontWeight: 600 }}>Chamar de volta</div>
        <div className="text-sm" style={{ color: C.muted }}>{filt.length} paciente(s)</div>
      </div>
      <div className="flex gap-1.5 mb-4 flex-wrap">
        {[["todos", "Todos"], ["botox", "Botox · 5m"], ["bio", "Bioestimulador · 6m"], ["harmo", "Harmonização · 4m"]].map(([k, l]) => (
          <button key={k} onClick={() => setFiltro(k)} className="text-xs rounded-full px-3 py-1.5 font-medium"
                  style={{ background: filtro === k ? C.ink : C.surface, color: filtro === k ? "#fff" : C.muted, border: `1px solid ${filtro === k ? C.ink : C.line}` }}>{l}</button>
        ))}
      </div>

      {grupos.map((grupo) => {
        const atrasado = grupo.chave === "atrasados";
        const feito = grupo.chave === "chamados";
        return (
          <div key={grupo.chave} className="mb-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="text-sm font-semibold" style={{ color: atrasado ? C.coral : feito ? C.muted : C.ink }}>{grupo.titulo}</div>
              <div className="text-xs rounded-full px-2 py-0.5"
                   style={{ background: atrasado ? C.coralSoft : feito ? C.bg : C.tealSoft, color: atrasado ? C.coral : feito ? C.muted : C.teal }}>
                {grupo.linhas.length}
              </div>
              <div className="flex-1" style={{ height: 1, background: C.line }} />
            </div>

            <div className="space-y-2">
              {grupo.linhas.map(({ m, e, marca }) => {
                const wa = m.phone ? "https://wa.me/55" + m.phone.replace(/\D/g, "") : null;
                return (
                  <div key={m.name + e.cat} className="rounded-2xl p-3.5"
                       style={{ background: C.surface, border: `1px solid ${atrasado ? C.coral : C.line}`, opacity: feito ? 0.72 : 1 }}>
                    <div className="flex items-center gap-3">
                      <button onClick={() => onHistory(m.name)} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 ff-d text-sm"
                              style={{ background: C.tealSoft, color: C.teal, fontWeight: 700 }}>{initials(m.name)}</button>
                      <button onClick={() => onHistory(m.name)} className="flex-1 min-w-0 text-left">
                        <div className="font-semibold truncate" style={{ color: C.ink }}>{m.name}</div>
                        <div className="text-xs truncate" style={{ color: C.muted }}>
                          {e.label} em {shortDate(e.date)} · {m.phone || "sem telefone"}
                        </div>
                      </button>
                      <div className="text-right shrink-0">
                        <div className="ff-d text-sm" style={{ fontWeight: 700, color: atrasado ? C.coral : C.ink }}>{shortDate(e.chamarKey)}</div>
                        <div className="text-xs" style={{ color: atrasado ? C.coral : C.muted }}>
                          {marca ? `chamado ${shortDate(marca.em)}` : chamarLabel(e.chamarKey)}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-3">
                      {wa && <a href={wa} target="_blank" rel="noreferrer" className="flex-1 text-center text-xs rounded-lg py-2 font-medium flex items-center justify-center gap-1.5" style={{ background: C.goodBg, color: C.goodFg }}><MessageCircle size={13} /> WhatsApp</a>}
                      <button onClick={() => onAgendar({ name: m.name, phone: m.phone, instagram: m.instagram })} className="flex-1 text-xs rounded-lg py-2 font-medium" style={{ background: C.ink, color: "#fff" }}>Agendar</button>
                    </div>
                    {marca ? (
                      <button onClick={() => onDesfazer(chaveDe(m.name, e.cat))}
                              className="w-full text-xs rounded-lg py-2 mt-1.5 font-medium"
                              style={{ background: C.bg, color: C.muted, border: `1px solid ${C.line}` }}>
                        Desfazer · voltar para a fila
                      </button>
                    ) : (
                      <button onClick={() => onChamar(chaveDe(m.name, e.cat), e.date)}
                              className="w-full text-xs rounded-lg py-2 mt-1.5 font-medium flex items-center justify-center gap-1.5"
                              style={{ background: C.tealSoft, color: C.teal, border: `1px solid ${C.line}` }}>
                        <Check size={13} /> Já chamei
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Histórico completo do paciente ----------------------------------------
function PatientHistory({ name, items, onClose, onAgendar, onOpenConsulta }) {
  const consultas = useMemo(() => items
    .filter((it) => (it.patient || "").trim().toLowerCase() === name.trim().toLowerCase())
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)), [items, name]);
  let phone = "", instagram = "";
  consultas.forEach((it) => { if (it.phone) phone = it.phone; if (it.instagram) instagram = igHandle(it.instagram); });
  const ativos = consultas.filter((c) => c.status !== "cancelado");
  const totalFat = ativos.reduce((s, c) => s + valorDe(c), 0);
  const totalPago = ativos.reduce((s, c) => s + recebidoDe(c), 0);
  const saldo = Math.max(totalFat - totalPago, 0);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, background: "#26232a66", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div className="ag-pop ag-scroll ff-b" onClick={(e) => e.stopPropagation()}
           style={{ background: C.surface, width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", borderRadius: 18, padding: 20 }}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 ff-d" style={{ background: C.tealSoft, color: C.teal, fontWeight: 700 }}>{initials(name)}</div>
            <div className="min-w-0">
              <div className="ff-d text-lg truncate" style={{ fontWeight: 600, color: C.ink }}>{name}</div>
              <div className="text-xs truncate" style={{ color: C.muted }}>
                {instagram ? "@" + instagram : ""}{instagram && phone ? " · " : ""}{phone || ""}{!instagram && !phone ? "sem contato" : ""}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.bg }}>
            <X size={17} color={C.ink} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl p-2.5 text-center" style={{ background: C.bg }}>
            <div className="text-xs" style={{ color: C.muted }}>Consultas</div>
            <div className="ff-d" style={{ fontWeight: 700, color: C.ink }}>{ativos.length}</div>
          </div>
          <div className="rounded-xl p-2.5 text-center" style={{ background: C.bg }}>
            <div className="text-xs" style={{ color: C.muted }}>Faturado</div>
            <div className="ff-d text-sm" style={{ fontWeight: 700, color: C.ink }}>{brl(totalFat)}</div>
          </div>
          <div className="rounded-xl p-2.5 text-center" style={{ background: saldo > 0 ? C.coralSoft : C.goodBg }}>
            <div className="text-xs" style={{ color: saldo > 0 ? C.coral : C.goodFg }}>{saldo > 0 ? "A receber" : "Em dia"}</div>
            <div className="ff-d text-sm" style={{ fontWeight: 700, color: saldo > 0 ? C.coral : C.goodFg }}>{saldo > 0 ? brl(saldo) : "✓"}</div>
          </div>
        </div>

        <button onClick={() => onAgendar({ name, phone, instagram })} className="w-full text-sm rounded-xl py-2.5 font-semibold mb-4" style={{ background: C.ink, color: "#fff" }}>
          Agendar nova consulta
        </button>

        <div className="text-xs font-medium mb-2" style={{ color: C.muted }}>HISTÓRICO</div>
        <div className="space-y-2">
          {consultas.length === 0 ? (
            <div className="text-sm text-center py-6" style={{ color: C.muted }}>Nenhuma consulta registrada.</div>
          ) : consultas.map((it) => {
            const s = STATUS[it.status] || STATUS.pendente;
            const saldoC = saldoDe(it);
            return (
              <button key={it.id} onClick={() => onOpenConsulta(it)} className="w-full text-left rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>{shortDate(it.date)}/{parseKey(it.date).getFullYear()} · {it.time}</div>
                  <span className="text-xs rounded-full px-2 py-0.5 shrink-0" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
                </div>
                {procsLabel(it) && <div className="text-sm mt-0.5" style={{ color: C.teal }}>{procsLabel(it)}</div>}
                {valorDe(it) > 0 && (
                  <div className="text-xs mt-1" style={{ color: C.muted }}>
                    {brl(it.valor)}
                    {totalPagoDe(it) > 0 ? ` · pago ${brl(totalPagoDe(it))}` : ""}{pagResumo(it) ? ` (${pagResumo(it)})` : ""}
                    {saldoC > 0 ? ` · resta ${brl(saldoC)}` : " · quitado"}
                  </div>
                )}
                {it.aviso && <div className="text-xs mt-1" style={{ color: C.warnFg }}>⚠ {it.aviso}</div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const weekLabel = (selKey, span = 7) => {
  const base = parseKey(selKey);
  let start, end;
  if (span >= 7) { start = new Date(base); start.setDate(base.getDate() - base.getDay()); end = new Date(start); end.setDate(start.getDate() + 6); }
  else { start = new Date(base); end = new Date(base); end.setDate(base.getDate() + span - 1); }
  const mesA = MESES[start.getMonth()].slice(0, 3).toLowerCase(); const mesB = MESES[end.getMonth()].slice(0, 3).toLowerCase();
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()} – ${end.getDate()} ${mesB}`
    : `${start.getDate()} ${mesA} – ${end.getDate()} ${mesB}`;
};

function WeekView({ selected, span = 3, items, onOpen, onDay }) {
  const wide = span <= 3;
  const HOUR_PX = wide ? 66 : 54, GUTTER = 46, DAY_MIN = wide ? 152 : 104;
  const base = parseKey(selected);
  let days;
  if (span >= 7) {
    const start = new Date(base); start.setDate(base.getDate() - base.getDay());
    days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return keyOf(d); });
  } else {
    days = Array.from({ length: span }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); return keyOf(d); });
  }

  const byDay = {}; for (const k of days) byDay[k] = [];
  let minStart = 8 * 60, maxEnd = 19 * 60;
  for (const it of items) {
    if (!byDay[it.date]) continue;
    const [sh, sm] = it.time.split(":").map(Number);
    const startMin = sh * 60 + sm;
    let endMin = startMin + 60;
    if (it.endTime) { const [eh, em] = it.endTime.split(":").map(Number); endMin = eh * 60 + em; }
    if (endMin <= startMin) endMin = startMin + 30;
    minStart = Math.min(minStart, startMin); maxEnd = Math.max(maxEnd, endMin);
    byDay[it.date].push({ ...it, startMin, endMin });
  }
  const startHour = Math.floor(minStart / 60), endHour = Math.ceil(maxEnd / 60);
  const rangeStart = startHour * 60, totalMin = (endHour - startHour) * 60, PPM = HOUR_PX / 60;
  const hours = []; for (let h = startHour; h <= endHour; h++) hours.push(h);

  return (
    <div className="ag-fade rounded-2xl" style={{ background: C.surface, border: `1px solid ${C.line}`, overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: GUTTER + days.length * DAY_MIN }}>
          <div className="flex" style={{ borderBottom: `1px solid ${C.line}` }}>
            <div style={{ width: GUTTER, flexShrink: 0 }} />
            {days.map((k) => {
              const d = parseKey(k); const isToday = k === todayKey(); const isSel = k === selected;
              const n = byDay[k].filter((x) => x.status !== "cancelado").length;
              return (
                <button key={k} onClick={() => onDay(k)} className="text-center py-2" style={{ flex: 1, minWidth: DAY_MIN, background: isSel ? C.bg : "transparent", borderLeft: `1px solid ${C.line}` }}>
                  <div className="text-xs" style={{ color: C.faint, textTransform: "uppercase", letterSpacing: 0.5 }}>{DIAS[d.getDay()]}</div>
                  <div className="ff-d mx-auto flex items-center justify-center" style={{ width: 27, height: 27, borderRadius: 14, fontWeight: 600, fontSize: 14, background: isToday ? C.coral : "transparent", color: isToday ? "#fff" : C.ink }}>{d.getDate()}</div>
                  <div className="text-xs mt-0.5" style={{ color: n > 0 ? C.muted : "transparent" }}>{n > 0 ? (wide ? `${n} atend.` : n) : "0"}</div>
                </button>
              );
            })}
          </div>
          <div style={{ position: "relative", height: totalMin * PPM + 6 }}>
            {hours.map((h) => {
              const top = (h * 60 - rangeStart) * PPM;
              return (
                <div key={h} style={{ position: "absolute", top, left: 0, right: 0 }}>
                  <div style={{ position: "absolute", left: 0, top: -6, width: GUTTER - 6, textAlign: "right", fontSize: 10, color: C.faint }}>{pad(h)}h</div>
                  <div style={{ position: "absolute", left: GUTTER, right: 0, borderTop: `1px solid ${C.line}` }} />
                </div>
              );
            })}
            <div className="flex" style={{ position: "absolute", left: GUTTER, right: 0, top: 0, bottom: 0 }}>
              {days.map((k) => {
                const laid = layoutDay(byDay[k]); const isToday = k === todayKey();
                return (
                  <div key={k} style={{ flex: 1, minWidth: DAY_MIN, position: "relative", borderLeft: `1px solid ${C.line}`, background: isToday ? "#A055740A" : "transparent" }}>
                    {laid.map((ev) => {
                      const s = STATUS[ev.status] || STATUS.pendente;
                      const top = (ev.startMin - rangeStart) * PPM;
                      const height = Math.max((ev.endMin - ev.startMin) * PPM - 2, wide ? 36 : 24);
                      const w = 100 / ev._cols, left = ev._col * w;
                      return (
                        <button key={ev.id} onClick={() => onOpen(ev)}
                                style={{ position: "absolute", top, height, left: `calc(${left}% + 1px)`, width: `calc(${w}% - 2px)`, background: s.bg, borderLeft: `3px solid ${s.dot}`, borderRadius: 6, padding: wide ? "4px 8px" : "2px 5px", overflow: "hidden", textAlign: "left", opacity: ev.status === "cancelado" ? 0.5 : 1 }}>
                          <div style={{ fontSize: wide ? 11 : 10, fontWeight: 600, color: s.fg, lineHeight: 1.15 }}>{ev.time}{wide && ev.endTime ? `–${ev.endTime}` : ""}</div>
                          <div className="truncate" style={{ fontSize: wide ? 13 : 11, fontWeight: 600, color: C.ink, lineHeight: 1.2 }}>{ev.patient}</div>
                          {procsLabel(ev) && height > (wide ? 46 : 42) && <div style={{ fontSize: wide ? 11 : 9, color: s.fg, lineHeight: 1.25, marginTop: 1, whiteSpace: wide ? "normal" : "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{procsLabel(ev)}</div>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NotasCard({ notas, onAdd, onToggle, onDel }) {
  const [txt, setTxt] = useState("");
  const add = () => { const t = txt.trim(); if (!t) return; onAdd(t); setTxt(""); };
  const pend = notas.filter((n) => !n.done).length;
  return (
    <div className="rounded-2xl p-4 mt-6" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between mb-3">
        <div className="ff-d text-base" style={{ fontWeight: 600 }}>Afazeres</div>
        {notas.length > 0 && <div className="text-xs" style={{ color: C.muted }}>{pend} pendente(s)</div>}
      </div>
      <div className="flex gap-2 mb-3">
        <input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }}
               placeholder="Escreva um afazer e aperte Enter…"
               className="flex-1 text-sm rounded-lg px-3 py-2" style={{ background: C.bg, border: `1px solid ${C.line}`, color: C.ink }} />
        <button onClick={add} className="rounded-lg px-3 py-2 text-sm font-medium shrink-0" style={{ background: C.ink, color: "#fff" }}><Plus size={16} /></button>
      </div>
      {notas.length === 0 ? (
        <div className="text-sm" style={{ color: C.faint }}>Nenhum afazer ainda.</div>
      ) : (
        <div className="space-y-1.5">
          {notas.map((n) => (
            <div key={n.id} className="flex items-center gap-2.5">
              <button onClick={() => onToggle(n.id)} className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: n.done ? C.goodBg : C.bg, border: `1px solid ${n.done ? C.goodFg : C.line}` }}>
                {n.done && <Check size={13} color={C.goodFg} />}
              </button>
              <span className="flex-1 text-sm" style={{ color: n.done ? C.faint : C.ink, textDecoration: n.done ? "line-through" : "none" }}>{n.text}</span>
              <button onClick={() => onDel(n.id)} style={{ color: C.faint }}><X size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PatientFormModal({ initial, onClose, onSave }) {
  const [f, setF] = useState({ name: "", phone: "", instagram: "", ...initial });
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const inputStyle = { width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 14, color: C.ink };
  const submit = () => { if (!f.name.trim()) return setErr("Informe o nome."); onSave({ ...f, name: f.name.trim(), instagram: igHandle(f.instagram) }); };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, background: "#26232a66", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div className="ag-pop ff-b" onClick={(e) => e.stopPropagation()}
           style={{ background: C.surface, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", borderRadius: 18, padding: 22 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="ff-d text-lg" style={{ fontWeight: 600, color: C.ink }}>{f.id ? "Editar paciente" : "Cadastrar paciente"}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg }}><X size={17} color={C.ink} /></button>
        </div>
        <div className="space-y-3">
          <Field label="Nome *">
            <input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Nome completo" style={inputStyle} />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Instagram">
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.faint, fontSize: 14 }}>@</span>
                <input value={igHandle(f.instagram)} onChange={(e) => set("instagram", e.target.value)} placeholder="usuario" style={{ ...inputStyle, paddingLeft: 24 }} />
              </div>
            </Field>
            <Field label="Telefone">
              <input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 00000-0000" style={inputStyle} />
            </Field>
          </div>
          {err && <div className="text-xs" style={{ color: C.coral }}>{err}</div>}
        </div>
        <div className="flex items-center gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-medium" style={{ background: C.bg, color: C.muted }}>Cancelar</button>
          <button onClick={submit} className="flex-1 rounded-xl py-2.5 text-sm font-semibold" style={{ background: C.ink, color: "#fff" }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

// ---- Controle de estoque ---------------------------------------------------
function UsarControl({ item, onUse }) {
  const [v, setV] = useState("");
  const inputStyle = { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 10px", fontSize: 14, color: C.ink, width: "100%" };
  const n = Number(v) || 0;
  const confirm = () => { if (n > 0) { onUse(item.id, n); setV(""); } };
  return (
    <div>
      <div className="text-xs mb-1" style={{ color: C.muted }}>Registrar uso</div>
      <div className="flex gap-1.5">
        <input inputMode="numeric" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") confirm(); }}
               placeholder="qtd usada" style={inputStyle} className="flex-1" />
        <button onClick={confirm} className="rounded-lg px-3 text-sm font-medium shrink-0 flex items-center gap-1" style={{ background: n > 0 ? C.ink : C.line, color: "#fff" }}>
          <Check size={14} /> Confirmar
        </button>
      </div>
    </div>
  );
}

function EstoqueView({ estoque, onAdd, onSet, onDel, onEdit }) {
  const [nome, setNome] = useState("");
  const [inicial, setInicial] = useState("");
  const [min, setMin] = useState("");
  const add = () => { const nm = nome.trim(); if (!nm) return; const ini = Number(inicial) || 0; onAdd({ nome: nm, inicial: ini, qtd: ini, min: Number(min) || 0 }); setNome(""); setInicial(""); setMin(""); };
  const inputStyle = { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 14, color: C.ink, width: "100%" };
  const baixo = estoque.filter((i) => i.min > 0 && i.qtd <= i.min).length;
  const ordered = [...estoque].sort((a, b) => {
    const la = a.min > 0 && a.qtd <= a.min ? 0 : 1; const lb = b.min > 0 && b.qtd <= b.min ? 0 : 1;
    return la - lb || a.nome.localeCompare(b.nome);
  });
  const handleUse = (id, n) => { const it = estoque.find((x) => x.id === id); if (it) onSet(id, it.qtd - n); };

  return (
    <div className="ag-fade">
      <div className="flex items-center justify-between mb-3">
        <div className="ff-d text-xl" style={{ fontWeight: 600 }}>Estoque</div>
        {baixo > 0 && <div className="text-xs rounded-full px-2.5 py-1 font-medium" style={{ background: C.coralSoft, color: C.coral }}>{baixo} em baixa</div>}
      </div>

      <div className="rounded-2xl p-3 mb-4" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
        <div className="flex gap-2 items-end flex-wrap">
          <div style={{ flex: "2 1 160px" }}>
            <div className="text-xs font-medium mb-1" style={{ color: C.muted }}>Produto</div>
            <input value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Ex: Toxina 100U, Ácido hialurônico…" style={inputStyle} />
          </div>
          <div style={{ flex: "1 1 70px" }}>
            <div className="text-xs font-medium mb-1" style={{ color: C.muted }}>Qtd inicial</div>
            <input inputMode="numeric" value={inicial} onChange={(e) => setInicial(e.target.value)} placeholder="0" style={inputStyle} />
          </div>
          <div style={{ flex: "1 1 70px" }}>
            <div className="text-xs font-medium mb-1" style={{ color: C.muted }}>Mínimo</div>
            <input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" style={inputStyle} />
          </div>
          <button onClick={add} className="rounded-lg px-4 font-medium shrink-0 flex items-center gap-1.5" style={{ background: C.ink, color: "#fff", height: 38 }}>
            <Plus size={16} /> Add
          </button>
        </div>
      </div>

      {ordered.length === 0 ? (
        <EmptyBlock icon={Package} title="Estoque vazio" text="Adicione os produtos que você usa nos procedimentos para controlar a quantidade." />
      ) : (
        <div className="space-y-2.5">
          {ordered.map((i) => {
            const low = i.min > 0 && i.qtd <= i.min;
            const inicial = i.inicial != null ? i.inicial : i.qtd;
            const usados = Math.max(inicial - i.qtd, 0);
            return (
              <div key={i.id} className="rounded-2xl p-4" style={{ background: C.surface, border: `1px solid ${low ? C.coral : C.line}` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate flex items-center gap-2" style={{ color: C.ink }}>
                      {i.nome}
                      {low && <span className="text-xs rounded-full px-2 py-0.5 font-medium shrink-0" style={{ background: C.coralSoft, color: C.coral }}>baixo</span>}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                      início {inicial} · sobrou <span style={{ color: low ? C.coral : C.ink, fontWeight: 600 }}>{i.qtd}</span>{i.min > 0 ? ` · mín ${i.min}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => onEdit(i)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg, color: C.ink }}><Pencil size={14} /></button>
                    <button onClick={() => onDel(i.id)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: C.faint }}><X size={16} /></button>
                  </div>
                </div>
                <div className="flex items-end gap-3 mt-3">
                  <div className="flex-1 min-w-0">
                    <UsarControl item={i} onUse={handleUse} />
                  </div>
                  <div className="rounded-xl px-4 py-2 text-center shrink-0" style={{ background: C.tealSoft, minWidth: 86 }}>
                    <div className="text-xs" style={{ color: C.teal }}>usados</div>
                    <div className="ff-d" style={{ fontSize: 28, fontWeight: 700, color: C.teal, lineHeight: 1.1 }}>{usados}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EstoqueFormModal({ initial, onClose, onSave }) {
  const [f, setF] = useState({ nome: "", inicial: 0, qtd: 0, min: 0, ...initial });
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const inputStyle = { width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 14, color: C.ink };
  const submit = () => {
    if (!String(f.nome).trim()) return setErr("Informe o nome do produto.");
    onSave({ ...f, nome: String(f.nome).trim(), inicial: Number(f.inicial) || 0, qtd: Number(f.qtd) || 0, min: Number(f.min) || 0 });
  };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, background: "#26232a66", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div className="ag-pop ff-b" onClick={(e) => e.stopPropagation()}
           style={{ background: C.surface, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", borderRadius: 18, padding: 22 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="ff-d text-lg" style={{ fontWeight: 600, color: C.ink }}>Editar produto</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg }}><X size={17} color={C.ink} /></button>
        </div>
        <div className="space-y-3">
          <Field label="Produto"><input autoFocus value={f.nome} onChange={(e) => set("nome", e.target.value)} style={inputStyle} /></Field>
          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Qtd inicial"><input inputMode="numeric" value={f.inicial} onChange={(e) => set("inicial", e.target.value)} style={inputStyle} /></Field>
            <Field label="Sobrou"><input inputMode="numeric" value={f.qtd} onChange={(e) => set("qtd", e.target.value)} style={inputStyle} /></Field>
            <Field label="Mínimo"><input inputMode="numeric" value={f.min} onChange={(e) => set("min", e.target.value)} style={inputStyle} /></Field>
          </div>
          {err && <div className="text-xs" style={{ color: C.coral }}>{err}</div>}
        </div>
        <div className="flex items-center gap-2 mt-5">
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-medium" style={{ background: C.bg, color: C.muted }}>Cancelar</button>
          <button onClick={submit} className="flex-1 rounded-xl py-2.5 text-sm font-semibold" style={{ background: C.ink, color: "#fff" }}>Salvar</button>
        </div>
      </div>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const inputStyle = { width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.ink };
  const entrar = async () => { setErr(""); const ok = await onLogin(email, senha); if (!ok) setErr("E-mail ou senha incorretos."); };
  return (
    <div className="ff-b" style={{ minHeight: "100vh", background: C.ink, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div className="text-center text-white mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span style={{ height: 1, width: 34, background: "#fff", opacity: 0.3 }} />
            <span className="ff-b" style={{ fontSize: 11, letterSpacing: 5, opacity: 0.8 }}>MENTORIA</span>
            <span style={{ height: 1, width: 34, background: "#fff", opacity: 0.3 }} />
          </div>
          <div className="ff-serif" style={{ fontSize: 34, lineHeight: 1.03 }}>Harmonização Facial</div>
          <div className="ff-serif" style={{ fontSize: 24, letterSpacing: 5, opacity: 0.92 }}>FULL FACE</div>
          <div className="ff-b" style={{ fontSize: 11, letterSpacing: 6, opacity: 0.5, marginTop: 6 }}>IMERSÃO</div>
        </div>
        <div style={{ background: C.surface, borderRadius: 18, padding: 24, boxShadow: "0 20px 50px #0004" }}>
          <div className="ff-d" style={{ fontSize: 18, fontWeight: 600, color: C.ink }}>Entrar</div>
          <div className="text-sm mb-4" style={{ color: C.muted }}>Acesso à agenda</div>
          <div className="space-y-3">
            <Field label="E-mail">
              <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") entrar(); }} placeholder="seu@email.com" style={inputStyle} />
            </Field>
            <Field label="Senha">
              <div style={{ position: "relative" }}>
                <input type={show ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") entrar(); }} placeholder="••••••••" style={{ ...inputStyle, paddingRight: 40 }} />
                <button onClick={() => setShow((s) => !s)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: C.faint }}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            {err && <div className="text-xs" style={{ color: C.coral }}>{err}</div>}
            <button onClick={entrar} className="w-full rounded-xl py-3 text-sm font-semibold" style={{ background: C.ink, color: "#fff", marginTop: 4 }}>Entrar</button>
          </div>
        </div>
        <div className="text-center text-xs mt-5" style={{ color: "#ffffff55" }}>Mentoria HOF · acesso restrito</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium block mb-1" style={{ color: C.muted }}>{label}</span>
      {children}
    </label>
  );
}

function FormModal({ initial, procs, pacientes, onClose, onSave, onDelete }) {
  const procByName = (n) => procByNameIn(procs, n);
  const [f, setF] = useState(() => {
    const base = {
      patient: "", phone: "", instagram: "", date: "", time: "09:00", endTime: "10:00",
      procedure: "", procedures: [], valor: "", precoModo: "vista", pagamentos: [], aviso: "", notes: "", status: "pendente", ...initial,
    };
    if ((!base.pagamentos || !base.pagamentos.length) && toNum(base.sinal) > 0) {
      base.pagamentos = [{ valor: base.sinal, forma: base.formaPgto || "", conta: base.sinalPara || "", parcelas: base.parcelas || "" }];
    }
    return base;
  });
  const [focoPaciente, setFocoPaciente] = useState(false);
  const [escolhido, setEscolhido] = useState(!!(initial && initial.patient));
  const buscaNome = normNome(f.patient);
  const sugestoes = useMemo(() => {
    if (!focoPaciente || escolhido || buscaNome.length < 2) return [];
    return (pacientes || [])
      .filter((p) => normNome(p.name).includes(buscaNome))
      .slice(0, 6);
  }, [pacientes, buscaNome, focoPaciente, escolhido]);
  // nome digitado bate com alguem que ja existe, so escrito diferente
  const jaExiste = useMemo(
    () => (pacientes || []).find((p) => normNome(p.name) === buscaNome && p.name !== f.patient.trim()),
    [pacientes, buscaNome, f.patient]
  );
  const usarPaciente = (p) => {
    setF((prev) => ({ ...prev, patient: p.name, phone: p.phone || prev.phone, instagram: p.instagram || prev.instagram }));
    setEscolhido(true);
    setFocoPaciente(false);
  };
  const [customProc, setCustomProc] = useState(!!(initial.procedure && !procByName(initial.procedure)));
  const [err, setErr] = useState("");
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const recalc = (st) => {
    const comTaxa = st.precoModo === "taxa";
    const nomes = [st.procedure, ...(st.procedures || [])].filter(Boolean);
    let total = 0, achou = false;
    for (const nm of nomes) { const p = procByName(nm); if (p) { total += comTaxa ? p.parc : p.vista; achou = true; } }
    return achou ? { ...st, valor: String(total) } : st;
  };
  // So conclui quando o valor foi quitado. Sinal / pagamento parcial confirma a
  // consulta, mas NAO marca como concluida.
  // concluiuAuto lembra se o "concluido" veio daqui: se veio e o pagamento
  // deixar de cobrir o total (ex: corrigiram 600 para 150), volta para
  // confirmado. Se a pessoa marcou Concluido na mao, a escolha dela e mantida
  // - procedimento feito com saldo em aberto e caso legitimo.
  const concluiuAuto = React.useRef(false);
  const setPagamentos = (arr) => setF((prev) => {
    const pago = arr.reduce((sum, p) => sum + toNum(p.valor), 0);
    const total = toNum(prev.valor);
    let status = prev.status;
    if (prev.status !== "cancelado") {
      if (total > 0 && pago >= total) {
        if (status !== "concluido") concluiuAuto.current = true;
        status = "concluido";
      } else if (prev.status === "concluido" && concluiuAuto.current) {
        status = pago > 0 ? "confirmado" : "pendente";
        concluiuAuto.current = false;
      } else if (pago > 0 && prev.status === "pendente") {
        status = "confirmado";
      }
    }
    return { ...prev, pagamentos: arr, status };
  });
  // escolha manual passa a mandar: o automatico nao desfaz mais
  const setStatusManual = (k) => { concluiuAuto.current = false; set("status", k); };
  const addPag = () => setPagamentos([...(f.pagamentos || []), { valor: "", forma: "", conta: "", parcelas: "" }]);
  const updPag = (idx, patch) => setPagamentos((f.pagamentos || []).map((p, j) => (j === idx ? { ...p, ...patch } : p)));
  const removePag = (idx) => setPagamentos((f.pagamentos || []).filter((_, j) => j !== idx));
  const inputStyle = { width: "100%", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 14, color: C.ink };
  const totalPago = (f.pagamentos || []).reduce((s, p) => s + toNum(p.valor), 0);
  const saldo = toNum(f.valor) - totalPago;

  const submit = () => {
    if (!f.patient.trim()) return setErr("Informe o nome do paciente.");
    if (!f.date || !f.time) return setErr("Informe a data e o horário de início.");
    if (f.endTime && f.endTime <= f.time) return setErr("O horário de fim deve ser depois do início.");
    onSave({ ...f, patient: f.patient.trim(), instagram: igHandle(f.instagram) });
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "#26232a55", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
         onClick={onClose}>
      <div className="ag-pop ag-scroll ff-b" onClick={(e) => e.stopPropagation()}
           style={{ background: C.surface, width: "100%", maxWidth: 520, maxHeight: "92vh", overflowY: "auto", borderRadius: 18, padding: 20 }}>
        <div className="flex items-center justify-between mb-4">
          <div className="ff-d text-lg" style={{ fontWeight: 600, color: C.ink }}>{f.id ? "Editar consulta" : "Nova consulta"}</div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.bg }}>
            <X size={17} color={C.ink} />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Paciente *">
            <input autoFocus value={f.patient} placeholder="Nome completo" style={inputStyle}
                   onFocus={() => setFocoPaciente(true)}
                   onChange={(e) => { set("patient", e.target.value); setEscolhido(false); setFocoPaciente(true); }} />

            {sugestoes.length > 0 && (
              <div className="mt-1.5 rounded-xl overflow-hidden" style={{ border: `1px solid ${C.line}`, background: C.surface }}>
                <div className="px-3 pt-2 pb-1 text-xs" style={{ color: C.muted }}>Já cadastrados — toque para usar</div>
                {sugestoes.map((p) => (
                  <button key={p.name} type="button" onClick={() => usarPaciente(p)}
                          className="w-full text-left px-3 py-2 flex items-center gap-2"
                          style={{ borderTop: `1px solid ${C.line}` }}>
                    <User size={14} className="shrink-0" style={{ color: C.faint }} />
                    <span className="flex-1 min-w-0">
                      <span className="text-sm block truncate" style={{ color: C.ink }}>{p.name}</span>
                      {(p.phone || p.instagram || p.visits.length > 0) && (
                        <span className="text-xs" style={{ color: C.muted }}>
                          {[p.phone, p.instagram ? "@" + p.instagram : "",
                            p.visits.length ? `${p.visits.length} ${p.visits.length === 1 ? "consulta" : "consultas"}` : ""]
                            .filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {jaExiste && (
              <button type="button" onClick={() => usarPaciente(jaExiste)}
                      className="w-full text-left mt-1.5 rounded-xl px-3 py-2 text-xs"
                      style={{ background: C.coralSoft, color: C.coral, border: `1px solid ${C.coral}33` }}>
                Já existe <b>{jaExiste.name}</b> — toque para usar esse cadastro em vez de criar outro.
              </button>
            )}
          </Field>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Instagram">
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: C.faint, fontSize: 14 }}>@</span>
                <input value={igHandle(f.instagram)} onChange={(e) => set("instagram", e.target.value)} placeholder="usuario"
                       style={{ ...inputStyle, paddingLeft: 24 }} />
              </div>
            </Field>
            <Field label="Telefone">
              <input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 00000-0000" style={inputStyle} />
            </Field>
          </div>

          <Field label="Data *">
            <input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} style={inputStyle} />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Início *"><input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} style={inputStyle} /></Field>
            <Field label="Fim"><input type="time" value={f.endTime} onChange={(e) => set("endTime", e.target.value)} style={inputStyle} /></Field>
          </div>

          <Field label="Procedimento">
            <select value={customProc ? "__outro" : (f.procedure || "")} style={inputStyle}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "__outro") { setCustomProc(true); set("procedure", ""); }
                      else { setCustomProc(false); setF((prev) => recalc({ ...prev, procedure: v })); }
                    }}>
              <option value="">Selecione…</option>
              {procs.map((p) => <option key={p.nome} value={p.nome}>{p.nome} — {brl(p.vista)}</option>)}
              <option value="__outro">Outro (digitar)</option>
            </select>
            {customProc && (
              <input value={f.procedure} onChange={(e) => set("procedure", e.target.value)} placeholder="Nome do procedimento"
                     style={{ ...inputStyle, marginTop: 8 }} />
            )}
            {(f.procedures || []).map((nm, idx) => (
              <div key={idx} className="flex gap-1.5 mt-2">
                <select value={nm} style={{ ...inputStyle, flex: 1 }}
                        onChange={(e) => setF((prev) => { const arr = [...(prev.procedures || [])]; arr[idx] = e.target.value; return recalc({ ...prev, procedures: arr }); })}>
                  <option value="">Procedimento adicional…</option>
                  {procs.map((p) => <option key={p.nome} value={p.nome}>{p.nome} — {brl(p.vista)}</option>)}
                </select>
                <button onClick={() => setF((prev) => recalc({ ...prev, procedures: (prev.procedures || []).filter((_, j) => j !== idx) }))}
                        className="w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.bg, color: C.faint }}><X size={15} /></button>
              </div>
            ))}
            <button onClick={() => setF((prev) => ({ ...prev, procedures: [...(prev.procedures || []), ""] }))}
                    className="flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 font-medium mt-2" style={{ background: C.tealSoft, color: C.teal }}>
              <Plus size={13} /> Adicionar procedimento
            </button>
          </Field>

          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-xs font-medium" style={{ color: C.muted }}>Valor:</span>
            {[["vista", "À vista"], ["taxa", "Com taxa (cartão)"]].map(([k, l]) => (
              <button key={k} onClick={() => setF((prev) => recalc({ ...prev, precoModo: k }))} className="text-xs rounded-full px-3 py-1 font-medium"
                      style={{ background: f.precoModo === k ? C.ink : C.bg, color: f.precoModo === k ? "#fff" : C.muted, border: `1px solid ${f.precoModo === k ? C.ink : C.line}` }}>{l}</button>
            ))}
          </div>
          <Field label="Valor total (R$)">
            <input inputMode="decimal" value={f.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" style={inputStyle} />
          </Field>

          <div>
            <div className="text-xs font-medium mb-1" style={{ color: C.muted }}>Pagamentos <span style={{ color: C.faint }}>(pode dividir)</span></div>
            {(f.pagamentos || []).map((p, idx) => (
              <div key={idx} className="rounded-xl p-2.5 mb-2" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
                <div className="flex gap-1.5 items-center">
                  <input inputMode="decimal" value={p.valor} onChange={(e) => updPag(idx, { valor: e.target.value })} placeholder="R$ 0,00" style={{ ...inputStyle, background: C.surface, flex: 1 }} />
                  <select value={p.forma || ""} onChange={(e) => updPag(idx, { forma: e.target.value })} style={{ ...inputStyle, background: C.surface, width: 118 }}>
                    <option value="">Forma…</option>
                    {["Pix", "Dinheiro", "Crédito", "Débito"].map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                  <button onClick={() => removePag(idx)} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ color: C.faint }}><X size={15} /></button>
                </div>
                <div className="flex gap-1.5 items-center mt-1.5">
                  <div className="flex gap-1 flex-1">
                    {["Loan", "Mari"].map((c) => (
                      <button key={c} onClick={() => updPag(idx, { conta: p.conta === c ? "" : c })} className="flex-1 text-xs rounded-lg py-1.5 font-medium"
                              style={{ background: p.conta === c ? C.ink : C.surface, color: p.conta === c ? "#fff" : C.muted, border: `1px solid ${p.conta === c ? C.ink : C.line}` }}>{c}</button>
                    ))}
                  </div>
                  {p.forma === "Crédito" && (
                    <select value={p.parcelas || ""} onChange={(e) => updPag(idx, { parcelas: e.target.value })} style={{ ...inputStyle, background: C.surface, width: 84 }}>
                      {["", "1", "2", "3", "4"].map((n) => <option key={n} value={n}>{n ? n + "x" : "Parc."}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
            <button onClick={addPag} className="flex items-center gap-1 text-xs rounded-lg px-2.5 py-1.5 font-medium" style={{ background: C.tealSoft, color: C.teal }}>
              <Plus size={13} /> Adicionar pagamento
            </button>
          </div>

          {toNum(f.valor) > 0 && (
            <div className="rounded-xl p-3.5" style={{ background: saldo <= 0 ? C.goodBg : C.coralSoft, border: `1px solid ${(saldo <= 0 ? C.goodFg : C.coral) + "33"}` }}>
              <div className="flex justify-between text-xs mb-2" style={{ color: C.muted }}>
                <span>Total {brl(f.valor)}</span>
                <span>Pago {brl(totalPago)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: saldo <= 0 ? C.goodFg : C.coral }}>
                  {saldo <= 0 ? "Pagamento quitado" : (totalPago > 0 ? "Sinal pago · falta" : "Falta pagar")}
                </span>
                <span className="ff-d" style={{ fontSize: 26, fontWeight: 700, color: saldo <= 0 ? C.goodFg : C.coral }}>{brl(Math.max(saldo, 0))}</span>
              </div>
            </div>
          )}

          <Field label="Aviso">
            <input value={f.aviso} onChange={(e) => set("aviso", e.target.value)}
                   placeholder="Alerta importante (alergia, convênio, cuidado…)" style={inputStyle} />
          </Field>

          <Field label="Status">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(STATUS).map(([k, v]) => (
                <button key={k} onClick={() => setStatusManual(k)} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                        style={{ background: f.status === k ? v.bg : C.bg, color: f.status === k ? v.fg : C.faint,
                                 border: `1px solid ${f.status === k ? v.dot + "55" : C.line}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: 6, background: v.dot }} /> {v.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Observações">
            <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Anotações gerais…"
                      style={{ ...inputStyle, resize: "vertical" }} />
          </Field>

          {err && <div className="text-xs" style={{ color: C.coral }}>{err}</div>}
        </div>

        <div className="flex items-center gap-2 mt-5">
          {onDelete && (
            <button onClick={onDelete} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.coralSoft, color: C.coral }}>
              <Trash2 size={17} />
            </button>
          )}
          <button onClick={onClose} className="flex-1 rounded-xl py-2.5 text-sm font-medium" style={{ background: C.bg, color: C.muted }}>Cancelar</button>
          <button onClick={submit} className="flex-1 rounded-xl py-2.5 text-sm font-semibold" style={{ background: C.ink, color: "#fff" }}>
            {f.id ? "Salvar" : "Agendar"}
          </button>
        </div>
      </div>
    </div>
  );
}
