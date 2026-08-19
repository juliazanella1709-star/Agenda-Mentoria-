import React, { useState, useMemo } from "react";
import { AlertCircle, Plus, Pencil, Trash2, X } from "lucide-react";

// Aba "Procedimentos", com duas telas:
//  - Agendados: quantos de cada procedimento estao agendados
//  - Cadastro: gerenciar a lista de procedimentos e os precos
// O cadastro alimenta o menu do formulario de consulta e o calculo do valor.

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dataBR = (k) => { const [y, m, d] = String(k).split("-"); return `${d}/${m}/${y}`; };
const toNum = (s) => {
  if (typeof s === "number") return s;
  if (!s) return 0;
  const c = String(s).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(c);
  return isNaN(n) ? 0 : n;
};
const brl = (v) => toNum(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const procsDe = (it) => [it && it.procedure, ...(((it && it.procedures) || []))].filter(Boolean);

export default function ProcedimentosView({ items, procs, onSaveProcs, onRename, C }) {
  const [tela, setTela] = useState("agendados");

  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16 };
  const chip = (ativo) => ({
    background: ativo ? C.ink : C.surface, color: ativo ? "#fff" : C.muted,
    border: `1px solid ${ativo ? C.ink : C.line}`, borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 500,
  });

  return (
    <div className="ag-fade">
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTela("agendados")} style={chip(tela === "agendados")}>Agendados</button>
        <button onClick={() => setTela("cadastro")} style={chip(tela === "cadastro")}>Cadastro</button>
      </div>
      {tela === "agendados"
        ? <Agendados items={items} procs={procs} C={C} card={card} chip={chip} />
        : <Cadastro procs={procs} items={items} onSaveProcs={onSaveProcs} onRename={onRename} C={C} card={card} />}
    </div>
  );
}

// ---------------------------------------------------------------- agendados
function Agendados({ items, procs, C, card, chip }) {
  const hoje = new Date();
  const [periodo, setPeriodo] = useState("total");
  const [de, setDe] = useState(keyOf(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [ate, setAte] = useState(keyOf(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)));
  const [ocultarZerados, setOcultarZerados] = useState(false);

  const janela = useMemo(() => {
    if (periodo === "total") return null;
    if (periodo === "mes") {
      return { de: keyOf(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
               ate: keyOf(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)) };
    }
    return { de, ate };
  }, [periodo, de, ate]);

  const contagem = useMemo(() => {
    const m = {};
    for (const it of items || []) {
      if (it.status === "cancelado") continue;
      if (janela && (it.date < janela.de || it.date > janela.ate)) continue;
      for (const nome of procsDe(it)) m[nome] = (m[nome] || 0) + 1;
    }
    return m;
  }, [items, janela]);

  const nomesCadastro = useMemo(() => (procs || []).map((p) => p.nome), [procs]);

  const linhas = useMemo(() => {
    const set = new Set([...nomesCadastro, ...Object.keys(contagem)]);
    const arr = [...set].map((nome) => ({
      nome, qtd: contagem[nome] || 0, doCadastro: nomesCadastro.includes(nome),
    }));
    arr.sort((a, b) => (b.qtd - a.qtd) || a.nome.localeCompare(b.nome));
    return ocultarZerados ? arr.filter((l) => l.qtd > 0) : arr;
  }, [nomesCadastro, contagem, ocultarZerados]);

  const total = useMemo(() => linhas.reduce((s, l) => s + l.qtd, 0), [linhas]);
  const maior = useMemo(() => Math.max(1, ...linhas.map((l) => l.qtd)), [linhas]);

  const input = { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 14, color: C.ink, width: "100%" };

  return (
    <>
      <div className="p-4 mb-4" style={card}>
        <div className="text-sm font-medium mb-3" style={{ color: C.ink }}>Período</div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setPeriodo("total")} style={chip(periodo === "total")}>Total geral</button>
          <button onClick={() => setPeriodo("mes")} style={chip(periodo === "mes")}>Este mês</button>
          <button onClick={() => setPeriodo("custom")} style={chip(periodo === "custom")}>Escolher datas</button>
        </div>
        {periodo === "custom" && (
          <div className="flex gap-2 mt-3">
            <label className="flex-1">
              <div className="text-xs mb-1" style={{ color: C.muted }}>De</div>
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={input} />
            </label>
            <label className="flex-1">
              <div className="text-xs mb-1" style={{ color: C.muted }}>Até</div>
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={input} />
            </label>
          </div>
        )}
        {janela && <div className="text-xs mt-2" style={{ color: C.muted }}>Contando de {dataBR(janela.de)} a {dataBR(janela.ate)}.</div>}
      </div>

      <div className="flex items-center justify-between mb-3">
        <div className="text-sm" style={{ color: C.ink }}>
          <b>{total}</b> {total === 1 ? "procedimento agendado" : "procedimentos agendados"}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={ocultarZerados} onChange={() => setOcultarZerados((v) => !v)}
                 style={{ accentColor: C.coral, width: 16, height: 16 }} />
          <span className="text-xs" style={{ color: C.muted }}>Esconder os zerados</span>
        </label>
      </div>

      <div className="mb-4" style={{ ...card, overflow: "hidden" }}>
        {linhas.length === 0 && <div className="text-center py-10 text-sm" style={{ color: C.muted }}>Nenhum procedimento agendado.</div>}
        {linhas.map((l, i) => (
          <div key={l.nome} className="px-3.5 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm" style={{ color: l.qtd ? C.ink : C.muted }}>{l.nome}</div>
                {!l.doCadastro && <div className="text-xs mt-0.5" style={{ color: C.faint }}>fora do cadastro</div>}
              </div>
              <div className="text-xl font-medium shrink-0" style={{ color: l.qtd ? C.ink : C.faint, minWidth: 28, textAlign: "right" }}>{l.qtd}</div>
            </div>
            {l.qtd > 0 && (
              <div className="mt-2 rounded-full overflow-hidden" style={{ height: 5, background: C.bg }}>
                <div style={{ height: "100%", width: `${(l.qtd / maior) * 100}%`, background: C.coral, transition: "width .25s" }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-xs leading-relaxed p-3 rounded-xl flex gap-2" style={{ color: C.muted, background: C.tealSoft }}>
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <span>
          Conta os agendados, ignorando as canceladas. Uma consulta com dois procedimentos soma
          nos dois. Traz todos os procedimentos do cadastro, mesmo os ainda sem agendamento.
        </span>
      </div>
    </>
  );
}

// ----------------------------------------------------------------- cadastro
function Cadastro({ procs, items, onSaveProcs, onRename, C, card }) {
  const [form, setForm] = useState(null);   // { idx, nome, vista, parc, nomeOriginal }
  const [apagar, setApagar] = useState(null);

  // quantas consultas usam cada procedimento (para avisar antes de apagar)
  const usos = useMemo(() => {
    const m = {};
    for (const it of items || []) for (const n of procsDe(it)) m[n] = (m[n] || 0) + 1;
    return m;
  }, [items]);

  const novo = () => setForm({ idx: -1, nome: "", vista: "", parc: "", nomeOriginal: "" });
  const editar = (p, idx) => setForm({ idx, nome: p.nome, vista: String(p.vista ?? ""), parc: String(p.parc ?? ""), nomeOriginal: p.nome });

  const salvar = async () => {
    const nome = form.nome.trim();
    if (!nome) return;
    const dup = (procs || []).some((p, i) => p.nome === nome && i !== form.idx);
    if (dup) return;
    const reg = { nome, vista: toNum(form.vista), parc: toNum(form.parc) || toNum(form.vista) };
    const next = form.idx === -1 ? [...(procs || []), reg] : (procs || []).map((p, i) => (i === form.idx ? reg : p));
    if (form.idx !== -1 && form.nomeOriginal && form.nomeOriginal !== nome && onRename) {
      await onRename(form.nomeOriginal, nome);
    }
    onSaveProcs(next);
    setForm(null);
  };

  const confirmarApagar = () => {
    onSaveProcs((procs || []).filter((_, i) => i !== apagar.idx));
    setApagar(null);
  };

  const input = { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 14, color: C.ink, width: "100%" };
  const nomeDup = form && form.nome.trim() && (procs || []).some((p, i) => p.nome === form.nome.trim() && i !== form.idx);

  return (
    <>
      <button onClick={novo} className="w-full rounded-2xl py-3 font-medium flex items-center justify-center gap-2 mb-4"
              style={{ background: C.ink, color: "#fff" }}>
        <Plus size={17} /> Novo procedimento
      </button>

      <div className="mb-4" style={{ ...card, overflow: "hidden" }}>
        {(procs || []).length === 0 && (
          <div className="text-center py-10 text-sm" style={{ color: C.muted }}>Nenhum procedimento cadastrado.</div>
        )}
        {(procs || []).map((p, idx) => (
          <div key={p.nome + idx} className="px-3.5 py-3 flex items-center gap-2"
               style={{ borderTop: idx === 0 ? "none" : `1px solid ${C.line}` }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm" style={{ color: C.ink }}>{p.nome}</div>
              <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                À vista {brl(p.vista)} · Parcelado {brl(p.parc)}
                {usos[p.nome] ? ` · ${usos[p.nome]} ${usos[p.nome] === 1 ? "consulta" : "consultas"}` : ""}
              </div>
            </div>
            <button onClick={() => editar(p, idx)} className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ color: C.muted, border: `1px solid ${C.line}` }} aria-label="Editar"><Pencil size={15} /></button>
            <button onClick={() => setApagar({ idx, nome: p.nome })} className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ color: C.coral, border: `1px solid ${C.line}` }} aria-label="Remover"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>

      <div className="text-xs leading-relaxed p-3 rounded-xl flex gap-2" style={{ color: C.muted, background: C.tealSoft }}>
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <span>
          Esta lista alimenta o menu de procedimentos ao marcar uma consulta e o cálculo
          automático do valor. Ao renomear, as consultas já marcadas são atualizadas junto.
        </span>
      </div>

      {form && (
        <Overlay onClose={() => setForm(null)} C={C}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-base font-medium" style={{ color: C.ink }}>
              {form.idx === -1 ? "Novo procedimento" : "Editar procedimento"}
            </div>
            <button onClick={() => setForm(null)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: C.faint }}><X size={17} /></button>
          </div>

          <div className="text-xs mb-1" style={{ color: C.muted }}>Nome</div>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
                 placeholder="Ex: Preenchimento labial" style={input} />
          {nomeDup && <div className="text-xs mt-1" style={{ color: C.coral }}>Já existe um procedimento com esse nome.</div>}

          <div className="flex gap-2 mt-3">
            <label className="flex-1">
              <div className="text-xs mb-1" style={{ color: C.muted }}>À vista (R$)</div>
              <input inputMode="decimal" value={form.vista} onChange={(e) => setForm({ ...form, vista: e.target.value })} placeholder="0" style={input} />
            </label>
            <label className="flex-1">
              <div className="text-xs mb-1" style={{ color: C.muted }}>Parcelado (R$)</div>
              <input inputMode="decimal" value={form.parc} onChange={(e) => setForm({ ...form, parc: e.target.value })} placeholder="igual à vista" style={input} />
            </label>
          </div>

          {form.idx !== -1 && form.nomeOriginal !== form.nome.trim() && usos[form.nomeOriginal] > 0 && (
            <div className="text-xs mt-3 p-2.5 rounded-lg" style={{ background: C.coralSoft, color: C.coral }}>
              {usos[form.nomeOriginal]} {usos[form.nomeOriginal] === 1 ? "consulta usa" : "consultas usam"} o nome
              antigo e {usos[form.nomeOriginal] === 1 ? "será renomeada" : "serão renomeadas"} junto.
            </div>
          )}

          <button onClick={salvar} disabled={!form.nome.trim() || nomeDup}
                  className="w-full rounded-xl py-3 font-medium mt-4"
                  style={{ background: (!form.nome.trim() || nomeDup) ? C.line : C.ink, color: (!form.nome.trim() || nomeDup) ? C.muted : "#fff" }}>
            Salvar
          </button>
        </Overlay>
      )}

      {apagar && (
        <Overlay onClose={() => setApagar(null)} C={C}>
          <div className="text-base font-medium mb-2" style={{ color: C.ink }}>Remover procedimento</div>
          <div className="text-sm mb-1" style={{ color: C.muted }}>
            Tirar <b style={{ color: C.ink }}>{apagar.nome}</b> do cadastro?
          </div>
          {usos[apagar.nome] > 0 && (
            <div className="text-xs mt-2 p-2.5 rounded-lg" style={{ background: C.coralSoft, color: C.coral }}>
              {usos[apagar.nome]} {usos[apagar.nome] === 1 ? "consulta continua" : "consultas continuam"} com esse
              procedimento — {usos[apagar.nome] === 1 ? "ela não é apagada" : "elas não são apagadas"}, só passa a
              aparecer como “fora do cadastro”.
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={() => setApagar(null)} className="flex-1 rounded-xl py-3 font-medium"
                    style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}>Cancelar</button>
            <button onClick={confirmarApagar} className="flex-1 rounded-xl py-3 font-medium"
                    style={{ background: C.coral, color: "#fff" }}>Remover</button>
          </div>
        </Overlay>
      )}
    </>
  );
}

function Overlay({ children, onClose, C }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "#26232a55", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
         onClick={onClose}>
      <div className="ag-pop w-full" style={{ maxWidth: 420, background: C.surface, borderRadius: 18, padding: 18 }}
           onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
