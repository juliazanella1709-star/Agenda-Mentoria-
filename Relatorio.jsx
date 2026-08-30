import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

// Aba "Relatório": fechamento de um dia - o que entrou, como foi pago, quais
// atendimentos, os pagamentos das alunas e a posicao do estoque.

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const porExtenso = (k) => { const d = parseKey(k); return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; };

const toNum = (s) => {
  if (typeof s === "number") return s;
  if (!s) return 0;
  const c = String(s).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(c);
  return isNaN(n) ? 0 : n;
};
const brl = (v) => toNum(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const descontoDe = (it) => Math.min(toNum(it && it.desconto), toNum(it && it.valor));
const valorDe = (it) => Math.max(toNum(it.valor) - descontoDe(it), 0);
const pagList = (it) => (it.pagamentos && it.pagamentos.length)
  ? it.pagamentos
  : (toNum(it.sinal) > 0 ? [{ valor: it.sinal, forma: it.formaPgto, conta: it.sinalPara }] : []);
const totalPagoDe = (it) => pagList(it).reduce((s, p) => s + toNum(p.valor), 0);
const saldoDe = (it) => (it && it.parceria ? 0 : Math.max(valorDe(it) - totalPagoDe(it), 0));
const procsLabel = (it) => [it && it.procedure, ...(((it && it.procedures) || []))].filter(Boolean).join(" + ");

export default function RelatorioView({ items, alunas, estoque, C }) {
  const [dia, setDia] = useState(keyOf(new Date()));
  const andar = (n) => { const d = parseKey(dia); d.setDate(d.getDate() + n); setDia(keyOf(d)); };

  // --- consultas do dia -----------------------------------------------------
  const consultas = useMemo(
    () => (items || [])
      .filter((it) => it.date === dia && it.status !== "cancelado")
      .sort((a, b) => (a.time || "").localeCompare(b.time || "")),
    [items, dia]
  );

  // --- pagamentos de alunas com data no dia ---------------------------------
  const pagAlunas = useMemo(() => {
    const out = [];
    for (const a of alunas || []) {
      for (const p of a.pagamentos || []) if (p.data === dia) out.push({ aluna: a.nome, ...p });
      if (a.matriculaPaga && a.matriculaData === dia) {
        out.push({ aluna: a.nome, valor: null, forma: "", obs: "matrícula", ehMatricula: true });
      }
    }
    return out;
  }, [alunas, dia]);

  // --- totais ---------------------------------------------------------------
  const totais = useMemo(() => {
    const recConsultas = consultas.reduce((s, it) => s + totalPagoDe(it), 0);
    const recAlunas = pagAlunas.reduce((s, p) => s + toNum(p.valor), 0);
    const porForma = {};
    for (const it of consultas) {
      for (const p of pagList(it)) {
        const v = toNum(p.valor); if (v <= 0) continue;
        const k = p.forma || "Sem forma";
        porForma[k] = (porForma[k] || 0) + v;
      }
    }
    for (const p of pagAlunas) {
      const v = toNum(p.valor); if (v <= 0) continue;
      const k = p.forma || "Sem forma";
      porForma[k] = (porForma[k] || 0) + v;
    }
    const porConta = {};
    for (const it of consultas) {
      for (const p of pagList(it)) {
        const v = toNum(p.valor); if (v <= 0 || !p.conta) continue;
        porConta[p.conta] = (porConta[p.conta] || 0) + v;
      }
    }
    return {
      recConsultas, recAlunas, total: recConsultas + recAlunas,
      previsto: consultas.reduce((s, it) => s + valorDe(it), 0),
      aReceber: consultas.reduce((s, it) => s + saldoDe(it), 0),
      porForma: Object.entries(porForma).sort((a, b) => b[1] - a[1]),
      porConta: Object.entries(porConta).sort((a, b) => b[1] - a[1]),
    };
  }, [consultas, pagAlunas]);

  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16 };
  const Secao = ({ titulo, extra, children }) => (
    <div className="mb-4" style={{ ...card, overflow: "hidden" }}>
      <div className="px-4 py-3 flex items-baseline justify-between" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-sm font-medium" style={{ color: C.ink }}>{titulo}</div>
        {extra ? <div className="text-xs" style={{ color: C.muted }}>{extra}</div> : null}
      </div>
      {children}
    </div>
  );

  return (
    <div className="ag-fade">
      <div className="flex items-center justify-between mb-4">
        <div className="ff-d text-xl" style={{ fontWeight: 600 }}>Relatório</div>
        <div className="flex items-center gap-1">
          <button onClick={() => andar(-1)} className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.muted }}><ChevronLeft size={17} /></button>
          <button onClick={() => setDia(keyOf(new Date()))} className="text-xs rounded-lg px-3 py-2 font-medium"
                  style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.muted }}>Hoje</button>
          <button onClick={() => andar(1)} className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.muted }}><ChevronRight size={17} /></button>
        </div>
      </div>

      <div className="text-sm capitalize mb-3" style={{ color: C.muted }}>{porExtenso(dia)}</div>

      {/* ---- o que entrou ---- */}
      <div className="p-4 mb-4" style={{ ...card, background: C.ink }}>
        <div className="text-xs mb-1" style={{ color: "#ffffff99" }}>Entrou no dia</div>
        <div className="ff-d" style={{ fontSize: 32, fontWeight: 700, color: "#fff" }}>{brl(totais.total)}</div>
        <div className="text-xs mt-2" style={{ color: "#ffffff99" }}>
          Atendimentos {brl(totais.recConsultas)} · Alunas {brl(totais.recAlunas)}
        </div>
      </div>

      {totais.porForma.length > 0 && (
        <Secao titulo="Como foi pago">
          {totais.porForma.map(([forma, v]) => (
            <div key={forma} className="px-4 py-2.5 flex justify-between items-center" style={{ borderTop: `1px solid ${C.line}` }}>
              <span className="text-sm" style={{ color: C.ink }}>{forma}</span>
              <span className="text-sm font-semibold" style={{ color: C.ink }}>{brl(v)}</span>
            </div>
          ))}
          {totais.porConta.length > 0 && (
            <div className="px-4 py-2.5" style={{ borderTop: `1px solid ${C.line}`, background: C.bg }}>
              <div className="text-xs mb-1" style={{ color: C.muted }}>Por conta (atendimentos)</div>
              {totais.porConta.map(([conta, v]) => (
                <div key={conta} className="flex justify-between text-xs py-0.5">
                  <span style={{ color: C.muted }}>{conta}</span>
                  <span style={{ color: C.ink, fontWeight: 600 }}>{brl(v)}</span>
                </div>
              ))}
            </div>
          )}
        </Secao>
      )}

      {/* ---- atendimentos ---- */}
      <Secao titulo="Atendimentos" extra={`${consultas.length} · previsto ${brl(totais.previsto)}`}>
        {consultas.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: C.muted }}>Nenhum atendimento neste dia.</div>
        )}
        {consultas.map((it) => {
          const pago = totalPagoDe(it), saldo = saldoDe(it);
          const formas = pagList(it).filter((p) => toNum(p.valor) > 0)
            .map((p) => `${p.forma || "?"}${p.conta ? " " + p.conta : ""}`).join(" + ");
          return (
            <div key={it.id} className="px-4 py-3" style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: C.ink }}>
                    {it.time ? `${it.time} · ` : ""}{it.patient}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>{procsLabel(it) || "—"}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>{brl(valorDe(it))}</div>
                  {descontoDe(it) > 0 && (
                    <div className="text-xs" style={{ color: C.muted }}>desc. {brl(descontoDe(it))}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {it.parceria ? (
                  <span className="text-xs rounded-md px-1.5 py-0.5" style={{ background: C.tealSoft, color: C.teal }}>parceria</span>
                ) : pago > 0 ? (
                  <span className="text-xs" style={{ color: C.goodFg }}>pago {brl(pago)}{formas ? ` · ${formas}` : ""}</span>
                ) : (
                  <span className="text-xs" style={{ color: C.muted }}>sem pagamento</span>
                )}
                {saldo > 0 && <span className="text-xs" style={{ color: C.coral }}>falta {brl(saldo)}</span>}
              </div>
            </div>
          );
        })}
        {totais.aReceber > 0 && (
          <div className="px-4 py-2.5 flex justify-between text-xs" style={{ borderTop: `1px solid ${C.line}`, background: C.coralSoft }}>
            <span style={{ color: C.coral }}>A receber deste dia</span>
            <span style={{ color: C.coral, fontWeight: 700 }}>{brl(totais.aReceber)}</span>
          </div>
        )}
      </Secao>

      {/* ---- alunas ---- */}
      <Secao titulo="Pagamentos de alunas" extra={pagAlunas.length ? brl(totais.recAlunas) : ""}>
        {pagAlunas.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: C.muted }}>Nenhum pagamento de aluna neste dia.</div>
        )}
        {pagAlunas.map((p, i) => (
          <div key={i} className="px-4 py-3 flex items-start justify-between gap-3" style={{ borderTop: `1px solid ${C.line}` }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate" style={{ color: C.ink }}>{p.aluna}</div>
              <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                {p.ehMatricula ? "matrícula marcada como paga" : `${p.forma || "sem forma"}${p.obs ? ` · ${p.obs}` : ""}`}
              </div>
            </div>
            <div className="text-sm font-semibold shrink-0" style={{ color: p.ehMatricula ? C.muted : C.ink }}>
              {p.ehMatricula ? "—" : brl(p.valor)}
            </div>
          </div>
        ))}
      </Secao>

      {/* ---- estoque ---- */}
      <Secao titulo="Produtos" extra={`${(estoque || []).length} itens`}>
        {(estoque || []).length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: C.muted }}>Nenhum produto cadastrado.</div>
        )}
        {(estoque || []).length > 0 && (
          <div className="px-4 py-2 flex text-xs" style={{ borderTop: `1px solid ${C.line}`, background: C.bg, color: C.muted }}>
            <span className="flex-1">Produto</span>
            <span style={{ width: 52, textAlign: "right" }}>Início</span>
            <span style={{ width: 52, textAlign: "right" }}>Usado</span>
            <span style={{ width: 58, textAlign: "right" }}>Sobrou</span>
          </div>
        )}
        {(estoque || []).map((p) => {
          const ini = toNum(p.inicial), atual = toNum(p.qtd), usado = Math.max(ini - atual, 0);
          const baixo = atual <= toNum(p.min);
          return (
            <div key={p.id} className="px-4 py-2.5 flex items-center text-sm" style={{ borderTop: `1px solid ${C.line}` }}>
              <span className="flex-1 min-w-0 truncate" style={{ color: C.ink }}>{p.nome}</span>
              <span style={{ width: 52, textAlign: "right", color: C.muted }}>{ini}</span>
              <span style={{ width: 52, textAlign: "right", color: C.muted }}>{usado}</span>
              <span style={{ width: 58, textAlign: "right", color: baixo ? C.coral : C.ink, fontWeight: 600 }}>
                {atual}{baixo ? " ⚠" : ""}
              </span>
            </div>
          );
        })}
      </Secao>

      <div className="text-xs leading-relaxed p-3 rounded-xl flex gap-2" style={{ color: C.muted, background: C.tealSoft }}>
        <AlertCircle size={14} className="shrink-0 mt-0.5" />
        <span>
          Os pagamentos das consultas não guardam data própria, então entram no dia da consulta.
          Os das alunas têm data e são exatos. O estoque mostra a posição atual — <b>Usado</b> é o
          total desde o cadastro do produto, não o consumo do dia.
        </span>
      </div>
    </div>
  );
}
