import React, { useState, useMemo } from "react";
import { Check, AlertCircle } from "lucide-react";

// Aba "Procedimentos": controle do curso. Mostra quantos de cada procedimento
// ja foram feitos e quantos ainda faltam para bater a meta. A meta e digitada
// aqui e fica salva no banco (chave agenda:metas:v1).

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dataBR = (k) => { const [y, m, d] = String(k).split("-"); return `${d}/${m}/${y}`; };

// Cada consulta pode ter varios procedimentos (procedure + procedures[]).
const procsDe = (it) => [it && it.procedure, ...(((it && it.procedures) || []))].filter(Boolean);

export default function ProcedimentosView({ items, metas, onSaveMetas, procs, C }) {
  const hoje = new Date();
  const [periodo, setPeriodo] = useState("total"); // total | mes | custom
  const [de, setDe] = useState(keyOf(new Date(hoje.getFullYear(), hoje.getMonth(), 1)));
  const [ate, setAte] = useState(keyOf(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)));
  const [soFaltam, setSoFaltam] = useState(false);
  const [rascunho, setRascunho] = useState({}); // metas sendo editadas antes de salvar
  const [salvo, setSalvo] = useState(false);

  const janela = useMemo(() => {
    if (periodo === "total") return null;
    if (periodo === "mes") {
      return { de: keyOf(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
               ate: keyOf(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)) };
    }
    return { de, ate };
  }, [periodo, de, ate]);

  // Conta so o que nao foi cancelado; uma consulta com 2 procedimentos conta 1 em cada.
  const contagem = useMemo(() => {
    const m = {};
    for (const it of items || []) {
      if (it.status === "cancelado") continue;
      if (janela && (it.date < janela.de || it.date > janela.ate)) continue;
      for (const nome of procsDe(it)) m[nome] = (m[nome] || 0) + 1;
    }
    return m;
  }, [items, janela]);

  // Catalogo + qualquer procedimento digitado a mao que apareca nas consultas.
  const nomes = useMemo(() => {
    const set = new Set([...(procs || []), ...Object.keys(contagem)]);
    return [...set];
  }, [procs, contagem]);

  const metaDe = (nome) => {
    const r = rascunho[nome];
    if (r !== undefined) return r;
    const v = (metas || {})[nome];
    return v === undefined || v === null ? "" : String(v);
  };

  const linhas = useMemo(() => {
    const arr = nomes.map((nome) => {
      const feitos = contagem[nome] || 0;
      const meta = parseInt(metaDe(nome), 10);
      const temMeta = !isNaN(meta) && meta > 0;
      const faltam = temMeta ? Math.max(meta - feitos, 0) : null;
      return { nome, feitos, meta: temMeta ? meta : null, faltam, completo: temMeta && feitos >= meta };
    });
    arr.sort((a, b) => {
      // quem falta mais aparece primeiro; sem meta vai para o fim
      const fa = a.faltam === null ? -1 : a.faltam;
      const fb = b.faltam === null ? -1 : b.faltam;
      if (fb !== fa) return fb - fa;
      if (b.feitos !== a.feitos) return b.feitos - a.feitos;
      return a.nome.localeCompare(b.nome);
    });
    return soFaltam ? arr.filter((l) => l.faltam !== null && l.faltam > 0) : arr;
  }, [nomes, contagem, rascunho, metas, soFaltam]);

  const totais = useMemo(() => {
    let feitos = 0, meta = 0, faltam = 0;
    for (const nome of nomes) {
      feitos += contagem[nome] || 0;
      const m = parseInt(metaDe(nome), 10);
      if (!isNaN(m) && m > 0) { meta += m; faltam += Math.max(m - (contagem[nome] || 0), 0); }
    }
    return { feitos, meta, faltam };
  }, [nomes, contagem, rascunho, metas]);

  const temMudanca = Object.keys(rascunho).length > 0;

  const salvar = () => {
    const next = { ...(metas || {}) };
    for (const [nome, v] of Object.entries(rascunho)) {
      const n = parseInt(v, 10);
      if (isNaN(n) || n <= 0) delete next[nome];
      else next[nome] = n;
    }
    onSaveMetas(next);
    setRascunho({});
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2200);
  };

  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16 };
  const input = { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 14, color: C.ink, width: "100%" };
  const chip = (ativo) => ({
    background: ativo ? C.ink : C.surface, color: ativo ? "#fff" : C.muted,
    border: `1px solid ${ativo ? C.ink : C.line}`, borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 500,
  });

  return (
    <div className="ag-fade">
      <div className="p-4 mb-4" style={card}>
        <div className="text-sm font-medium mb-1" style={{ color: C.ink }}>Período</div>
        <div className="text-xs mb-3" style={{ color: C.muted }}>
          Para o controle do curso normalmente interessa o total geral.
        </div>
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

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Info label="Feitos" value={String(totais.feitos)} C={C} />
        <Info label="Meta" value={totais.meta > 0 ? String(totais.meta) : "—"} C={C} />
        <Info label="Faltam" value={totais.meta > 0 ? String(totais.faltam) : "—"} C={C}
              destaque={totais.meta > 0 && totais.faltam > 0} />
      </div>

      <div className="flex items-center justify-between mb-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={soFaltam} onChange={() => setSoFaltam((v) => !v)}
                 style={{ accentColor: C.coral, width: 16, height: 16 }} />
          <span className="text-sm" style={{ color: C.ink }}>Só os que faltam</span>
        </label>
        {salvo && (
          <span className="text-xs flex items-center gap-1" style={{ color: C.teal }}>
            <Check size={13} /> Metas salvas
          </span>
        )}
      </div>

      <div className="mb-4" style={{ ...card, overflow: "hidden" }}>
        {linhas.length === 0 && (
          <div className="text-center py-10 text-sm" style={{ color: C.muted }}>
            {soFaltam ? "Nenhum procedimento em falta." : "Nenhum procedimento ainda."}
          </div>
        )}
        {linhas.map((l, i) => (
          <div key={l.nome} className="p-3.5" style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="text-sm flex-1" style={{ color: C.ink }}>{l.nome}</div>
              {l.completo && (
                <span className="text-xs px-2 py-0.5 rounded-lg shrink-0" style={{ background: C.tealSoft, color: C.teal }}>
                  completo
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="shrink-0">
                <div className="text-xs" style={{ color: C.muted }}>Feitos</div>
                <div className="text-lg font-medium" style={{ color: C.ink }}>{l.feitos}</div>
              </div>

              <div className="shrink-0" style={{ width: 78 }}>
                <div className="text-xs mb-0.5" style={{ color: C.muted }}>Meta</div>
                <input inputMode="numeric" value={metaDe(l.nome)} placeholder="—"
                       onChange={(e) => setRascunho((p) => ({ ...p, [l.nome]: e.target.value.replace(/\D/g, "") }))}
                       style={{ ...input, padding: "5px 8px", textAlign: "center" }} />
              </div>

              <div className="shrink-0" style={{ width: 62 }}>
                <div className="text-xs" style={{ color: C.muted }}>Faltam</div>
                <div className="text-lg font-medium" style={{ color: l.faltam ? C.coral : C.muted }}>
                  {l.faltam === null ? "—" : l.faltam}
                </div>
              </div>
            </div>

            {l.meta !== null && (
              <div className="mt-2.5 rounded-full overflow-hidden" style={{ height: 6, background: C.bg }}>
                <div style={{
                  height: "100%",
                  width: `${Math.min((l.feitos / l.meta) * 100, 100)}%`,
                  background: l.completo ? C.teal : C.coral,
                  transition: "width .25s",
                }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {temMudanca && (
        <button onClick={salvar} className="w-full rounded-2xl py-3.5 font-medium"
                style={{ background: C.ink, color: "#fff" }}>
          Salvar metas
        </button>
      )}

      <div className="text-xs mt-5 leading-relaxed p-3 rounded-xl flex gap-2" style={{ color: C.muted, background: C.tealSoft }}>
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <span>
          Conta uma vez por procedimento em cada consulta, ignorando as canceladas. Uma consulta
          com dois procedimentos soma nos dois. Digite a meta e toque em <b>Salvar metas</b> —
          ela fica guardada para todo mundo que acessa a agenda.
        </span>
      </div>
    </div>
  );
}

function Info({ label, value, C, destaque }) {
  return (
    <div className="rounded-xl p-3" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
      <div className="text-xs mb-0.5" style={{ color: C.muted }}>{label}</div>
      <div className="text-lg font-medium" style={{ color: destaque ? C.coral : C.ink }}>{value}</div>
    </div>
  );
}
