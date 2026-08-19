import React, { useState, useMemo } from "react";
import { AlertCircle } from "lucide-react";

// Aba "Procedimentos": quantos de cada procedimento estao agendados.
// Lista o cadastro inteiro (inclusive os que ainda estao zerados) mais
// qualquer procedimento digitado a mao que tenha aparecido nas consultas.

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dataBR = (k) => { const [y, m, d] = String(k).split("-"); return `${d}/${m}/${y}`; };

// Cada consulta pode ter varios procedimentos (procedure + procedures[]).
const procsDe = (it) => [it && it.procedure, ...(((it && it.procedures) || []))].filter(Boolean);

export default function ProcedimentosView({ items, procs, C }) {
  const hoje = new Date();
  const [periodo, setPeriodo] = useState("total"); // total | mes | custom
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

  // Conta os agendados (tudo que nao foi cancelado). Uma consulta com dois
  // procedimentos soma 1 em cada um deles.
  const contagem = useMemo(() => {
    const m = {};
    for (const it of items || []) {
      if (it.status === "cancelado") continue;
      if (janela && (it.date < janela.de || it.date > janela.ate)) continue;
      for (const nome of procsDe(it)) m[nome] = (m[nome] || 0) + 1;
    }
    return m;
  }, [items, janela]);

  const linhas = useMemo(() => {
    const set = new Set([...(procs || []), ...Object.keys(contagem)]);
    const arr = [...set].map((nome) => ({
      nome,
      qtd: contagem[nome] || 0,
      doCadastro: (procs || []).includes(nome),
    }));
    arr.sort((a, b) => (b.qtd - a.qtd) || a.nome.localeCompare(b.nome));
    return ocultarZerados ? arr.filter((l) => l.qtd > 0) : arr;
  }, [procs, contagem, ocultarZerados]);

  const total = useMemo(() => linhas.reduce((s, l) => s + l.qtd, 0), [linhas]);
  const maior = useMemo(() => Math.max(1, ...linhas.map((l) => l.qtd)), [linhas]);

  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16 };
  const input = { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 14, color: C.ink, width: "100%" };
  const chip = (ativo) => ({
    background: ativo ? C.ink : C.surface, color: ativo ? "#fff" : C.muted,
    border: `1px solid ${ativo ? C.ink : C.line}`, borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 500,
  });

  return (
    <div className="ag-fade">
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
        {janela && (
          <div className="text-xs mt-2" style={{ color: C.muted }}>
            Contando de {dataBR(janela.de)} a {dataBR(janela.ate)}.
          </div>
        )}
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
        {linhas.length === 0 && (
          <div className="text-center py-10 text-sm" style={{ color: C.muted }}>Nenhum procedimento agendado.</div>
        )}
        {linhas.map((l, i) => (
          <div key={l.nome} className="px-3.5 py-3" style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm" style={{ color: l.qtd ? C.ink : C.muted }}>{l.nome}</div>
                {!l.doCadastro && (
                  <div className="text-xs mt-0.5" style={{ color: C.faint }}>fora do cadastro</div>
                )}
              </div>
              <div className="text-xl font-medium shrink-0" style={{ color: l.qtd ? C.ink : C.faint, minWidth: 28, textAlign: "right" }}>
                {l.qtd}
              </div>
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
          Conta os agendados, ignorando as consultas canceladas. Uma consulta com dois
          procedimentos soma nos dois. A lista traz todos os procedimentos do cadastro,
          mesmo os que ainda não têm nenhum agendamento.
        </span>
      </div>
    </div>
  );
}
