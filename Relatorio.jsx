import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, AlertCircle, Printer, FileDown } from "lucide-react";

// Aba "Relatório": fechamento de um dia - o que entrou, como foi pago, quais
// atendimentos, os pagamentos das alunas e a posicao do estoque.

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
const dataBR = (k) => { const [y, m, d] = String(k).split("-"); return d ? `${d}/${m}/${y}` : ""; };
const curto = (k) => { const [, m, d] = String(k).split("-"); return d ? `${d}/${m}` : ""; };
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
  const [modo, setModo] = useState("dia");        // dia | periodo
  const [de, setDe] = useState(keyOf(new Date()));
  const [ate, setAte] = useState(keyOf(new Date()));
  const andar = (n) => { const d = parseKey(dia); d.setDate(d.getDate() + n); setDia(keyOf(d)); };

  // janela vigente; no modo dia, de = ate = o dia escolhido
  const ini = modo === "dia" ? dia : de;
  const fim = modo === "dia" ? dia : ate;
  const noPeriodo = (k) => k >= ini && k <= fim;
  const varios = ini !== fim;
  const titulo = varios ? `${dataBR(ini)} a ${dataBR(fim)}` : porExtenso(ini);

  // --- consultas do dia -----------------------------------------------------
  const consultas = useMemo(
    () => (items || [])
      .filter((it) => noPeriodo(it.date) && it.status !== "cancelado")
      .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || ""))),
    [items, ini, fim]
  );

  // --- pagamentos de alunas com data no dia ---------------------------------
  const pagAlunas = useMemo(() => {
    const out = [];
    for (const a of alunas || []) {
      for (const p of a.pagamentos || []) if (noPeriodo(p.data || "")) out.push({ aluna: a.nome, ...p });
      if (a.matriculaPaga && noPeriodo(a.matriculaData || "")) {
        out.push({ aluna: a.nome, valor: null, forma: "", obs: "matrícula", ehMatricula: true });
      }
    }
    return out;
  }, [alunas, ini, fim]);

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
    // Por conta (Loan / Mari), detalhando as formas. Entram tanto os pagamentos
    // das consultas quanto os das alunas; sem conta preenchida cai em "Sem conta".
    const contas = {};
    const somaConta = (conta, forma, v) => {
      const k = conta || "Sem conta";
      if (!contas[k]) contas[k] = { total: 0, formas: {} };
      contas[k].total += v;
      const f = forma || "Sem forma";
      contas[k].formas[f] = (contas[k].formas[f] || 0) + v;
    };
    for (const it of consultas) {
      for (const p of pagList(it)) {
        const v = toNum(p.valor); if (v <= 0) continue;
        somaConta(p.conta, p.forma, v);
      }
    }
    for (const p of pagAlunas) {
      const v = toNum(p.valor); if (v <= 0) continue;
      somaConta(p.conta, p.forma, v);
    }
    const porConta = Object.entries(contas)
      .map(([nome, d]) => ({ nome, total: d.total, formas: Object.entries(d.formas).sort((a, b) => b[1] - a[1]) }))
      .sort((a, b) => b.total - a.total);
    return {
      recConsultas, recAlunas, total: recConsultas + recAlunas,
      parcerias: consultas.filter((it) => it.parceria).reduce((s, it) => s + valorDe(it), 0),
      qtdParcerias: consultas.filter((it) => it.parceria).length,
      descontos: consultas.reduce((s, it) => s + descontoDe(it), 0),
      previsto: consultas.reduce((s, it) => s + valorDe(it), 0),
      aReceber: consultas.reduce((s, it) => s + saldoDe(it), 0),
      porForma: Object.entries(porForma).sort((a, b) => b[1] - a[1]),
      porConta,
    };
  }, [consultas, pagAlunas]);


  // Monta o relatorio como documento do Word. Usa HTML com o cabecalho que o
  // Word reconhece: abre formatado e permite editar, sem biblioteca extra.
  const baixarWord = () => {
    const esc = (v) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const vermelho = (txt) => ({ html: `<b style="color:#C0392B">${esc(txt)}</b>` });
    const tabela = (cabs, linhas, alinhaDir = []) => {
      if (!linhas.length) return "<p style='color:#777'>Nada no período.</p>";
      const th = cabs.map((c, i) => `<th style="text-align:${alinhaDir.includes(i) ? "right" : "left"}">${esc(c)}</th>`).join("");
      const tr = linhas.map((l) =>
        `<tr>${l.map((c, i) => {
          const conteudo = c && typeof c === "object" && c.html !== undefined ? c.html : esc(c);
          return `<td style="text-align:${alinhaDir.includes(i) ? "right" : "left"}">${conteudo}</td>`;
        }).join("")}</tr>`
      ).join("");
      return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
    };

    const celValor = (it) => {
      if (it.parceria) {
        return { html: `<s style="color:#888">${esc(brl(valorDe(it)))}</s><br>` +
                       `<b style="color:#C0392B">PARCERIA</b>` };
      }
      if (descontoDe(it) > 0) {
        return { html: `<s style="color:#888">${esc(brl(it.valor))}</s><br>` +
                       `<b>${esc(brl(valorDe(it)))}</b><br>` +
                       `<span style="color:#C0392B">desconto ${esc(brl(descontoDe(it)))}</span>` };
      }
      return brl(valorDe(it));
    };
    const linhasAtend = consultas.map((it) => [
      curto(it.date), it.time || "", it.patient || "", procsLabel(it) || "—",
      celValor(it),
      it.parceria ? { html: '<b style="color:#C0392B">sem cobrança</b>' } : brl(totalPagoDe(it)),
      pagList(it).filter((x) => toNum(x.valor) > 0).map((x) => `${x.forma || "?"}${x.conta ? " " + x.conta : ""}`).join(" + "),
      saldoDe(it) > 0 ? brl(saldoDe(it)) : "",
    ]);
    const linhasAlunas = pagAlunas.map((p) => [
      curto(p.data || ""), p.aluna, p.ehMatricula ? "matrícula marcada como paga" : (p.forma || ""),
      p.obs || "", p.ehMatricula ? "—" : brl(p.valor),
    ]);
    const linhasProd = (estoque || []).map((p) => {
      const ini = toNum(p.inicial), atual = toNum(p.qtd);
      return [p.nome, ini, Math.max(ini - atual, 0), atual, toNum(p.min)];
    });

    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>Relatório</title>
      <style>
        body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#222}
        h1{font-size:16pt;margin:0 0 2pt}
        h2{font-size:12pt;margin:16pt 0 4pt;border-bottom:1px solid #ccc;padding-bottom:2pt}
        .sub{color:#666;font-size:10pt;margin:0 0 12pt}
        table{border-collapse:collapse;width:100%;margin:4pt 0}
        th,td{border:1px solid #d5d5d5;padding:4pt 6pt;font-size:10pt}
        th{background:#f2f0ee}
        .tot{font-size:14pt;font-weight:bold}
      </style></head><body>
      <h1>Mentoria HOF — Relatório</h1>
      <p class="sub">${esc(titulo)}</p>

      <h2>Resumo</h2>
      ${tabela(["Item", "Valor"], [
        ["Entrou no período", brl(totais.total)],
        ["  Atendimentos", brl(totais.recConsultas)],
        ["  Alunas", brl(totais.recAlunas)],
        ["Previsto (valor dos atendimentos)", brl(totais.previsto)],
        ["A receber", brl(totais.aReceber)],
        [vermelho("Parcerias (sem cobrança)"), vermelho(brl(totais.parcerias))],
        [vermelho("Descontos concedidos"), vermelho(brl(totais.descontos))],
      ], [1])}

      <h2>Como foi pago</h2>
      ${tabela(["Forma", "Valor"], totais.porForma.map(([f, v]) => [f, brl(v)]), [1])}
      ${totais.porConta.length ? `<h2>Entrou em cada conta</h2>${tabela(["Conta", "Forma", "Valor"],
        totais.porConta.flatMap((c) => [
          [{ html: `<b>${esc(c.nome)}</b>` }, "", { html: `<b>${esc(brl(c.total))}</b>` }],
          ...c.formas.map(([f, v]) => ["", f, brl(v)]),
        ]), [2])}` : ""}

      <h2>Atendimentos (${consultas.length})</h2>
      ${tabela(["Data", "Hora", "Paciente", "Procedimentos", "Valor", "Pago", "Forma", "Falta"], linhasAtend, [4, 5, 7])}

      <h2>Pagamentos de alunas</h2>
      ${tabela(["Data", "Aluna", "Forma", "Observação", "Valor"], linhasAlunas, [4])}

      <h2>Produtos</h2>
      ${tabela(["Produto", "Início", "Usado", "Sobrou", "Mínimo"], linhasProd, [1, 2, 3, 4])}
      </body></html>`;

    const blob = new Blob(["\ufeff", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-mentoria-hof-${ini}${varios ? "_a_" + fim : ""}.doc`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16 };
  const Secao = ({ titulo, extra, children }) => (
    <div className="mb-4 ag-bloco" style={{ ...card, overflow: "hidden" }}>
      <div className="px-4 py-3 flex items-baseline justify-between" style={{ borderBottom: `1px solid ${C.line}` }}>
        <div className="text-sm font-medium" style={{ color: C.ink }}>{titulo}</div>
        {extra ? <div className="text-xs" style={{ color: C.muted }}>{extra}</div> : null}
      </div>
      {children}
    </div>
  );

  return (
    <div className="ag-fade">
      <div className="ag-noprint">
        <div className="flex items-center justify-between mb-3">
          <div className="ff-d text-xl" style={{ fontWeight: 600 }}>Relatório</div>
          <div className="flex gap-2">
            <button onClick={baixarWord} className="flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 font-medium"
                    style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}>
              <FileDown size={15} /> Word
            </button>
            <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 font-medium"
                    style={{ background: C.ink, color: "#fff" }}>
              <Printer size={15} /> Imprimir
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          {[["dia", "Um dia"], ["periodo", "Período"]].map(([k, l]) => (
            <button key={k} onClick={() => setModo(k)} className="text-xs rounded-lg px-3 py-1.5 font-medium"
                    style={{ background: modo === k ? C.ink : C.surface, color: modo === k ? "#fff" : C.muted,
                             border: `1px solid ${modo === k ? C.ink : C.line}` }}>{l}</button>
          ))}
        </div>

        {modo === "dia" ? (
          <div className="flex items-center gap-1 mb-3">
            <button onClick={() => andar(-1)} className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.muted }}><ChevronLeft size={17} /></button>
            <input type="date" value={dia} onChange={(e) => setDia(e.target.value)}
                   style={{ flex: 1, background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 11px", fontSize: 14, color: C.ink }} />
            <button onClick={() => andar(1)} className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.muted }}><ChevronRight size={17} /></button>
            <button onClick={() => setDia(keyOf(new Date()))} className="text-xs rounded-lg px-3 py-2 font-medium shrink-0"
                    style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.muted }}>Hoje</button>
          </div>
        ) : (
          <div className="flex gap-2 mb-3">
            <label className="flex-1">
              <div className="text-xs mb-1" style={{ color: C.muted }}>De</div>
              <input type="date" value={de} onChange={(e) => setDe(e.target.value)}
                     style={{ width: "100%", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 11px", fontSize: 14, color: C.ink }} />
            </label>
            <label className="flex-1">
              <div className="text-xs mb-1" style={{ color: C.muted }}>Até</div>
              <input type="date" value={ate} onChange={(e) => setAte(e.target.value)}
                     style={{ width: "100%", background: C.surface, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 11px", fontSize: 14, color: C.ink }} />
            </label>
          </div>
        )}
      </div>

      {/* cabecalho que aparece so no papel */}
      <div className="ag-print-only" style={{ marginBottom: 14 }}>
        <div className="ff-d" style={{ fontSize: 18, fontWeight: 700 }}>Mentoria HOF — Relatório</div>
        <div style={{ fontSize: 12, color: "#555" }}>{titulo}</div>
      </div>

      <div className="text-sm capitalize mb-3 ag-noprint" style={{ color: C.muted }}>{titulo}</div>

      {/* ---- o que entrou ---- */}
      <div className="p-4 mb-4 ag-bloco" style={{ ...card, background: C.ink, WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
        <div className="text-xs mb-1" style={{ color: "#ffffff99" }}>{varios ? "Entrou no período" : "Entrou no dia"}</div>
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

        </Secao>
      )}

      {totais.porConta.length > 0 && (
        <Secao titulo="Entrou em cada conta" extra={brl(totais.total)}>
          {totais.porConta.map((c) => (
            <div key={c.nome} style={{ borderTop: `1px solid ${C.line}` }}>
              <div className="px-4 py-2.5 flex justify-between items-center" style={{ background: C.bg }}>
                <span className="text-sm font-semibold" style={{ color: C.ink }}>{c.nome}</span>
                <span className="text-sm font-semibold" style={{ color: C.ink }}>{brl(c.total)}</span>
              </div>
              {c.formas.map(([forma, v]) => (
                <div key={forma} className="px-4 py-2 flex justify-between items-center">
                  <span className="text-xs" style={{ color: C.muted, paddingLeft: 10 }}>{forma}</span>
                  <span className="text-xs" style={{ color: C.ink }}>{brl(v)}</span>
                </div>
              ))}
            </div>
          ))}
        </Secao>
      )}

      {totais.parcerias > 0 && (
        <div className="p-3.5 mb-4 ag-bloco rounded-2xl flex items-center justify-between"
             style={{ background: C.tealSoft, border: `1px solid ${C.teal}33` }}>
          <div>
            <div className="text-sm font-semibold" style={{ color: C.teal }}>
              {totais.qtdParcerias} {totais.qtdParcerias === 1 ? "parceria" : "parcerias"}
            </div>
            <div className="text-xs" style={{ color: C.muted }}>Procedimento feito sem cobrança — não entra no caixa</div>
          </div>
          <div className="ff-d" style={{ fontSize: 20, fontWeight: 700, color: C.teal }}>{brl(totais.parcerias)}</div>
        </div>
      )}

      {/* ---- atendimentos ---- */}
      <Secao titulo="Atendimentos" extra={`${consultas.length} · previsto ${brl(totais.previsto)}`}>
        {consultas.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: C.muted }}>Nenhum atendimento no período.</div>
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
                    {varios ? `${curto(it.date)} · ` : ""}{it.time ? `${it.time} · ` : ""}{it.patient}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>{procsLabel(it) || "—"}</div>
                </div>
                <div className="text-right shrink-0">
                  {it.parceria ? (
                    <>
                      <div className="text-sm" style={{ color: C.muted, textDecoration: "line-through" }}>{brl(valorDe(it))}</div>
                      <div className="text-xs" style={{ color: "#C0392B", fontWeight: 800, letterSpacing: ".04em" }}>PARCERIA</div>
                    </>
                  ) : descontoDe(it) > 0 ? (
                    <>
                      <div className="text-xs" style={{ color: C.muted, textDecoration: "line-through" }}>{brl(it.valor)}</div>
                      <div className="text-sm font-semibold" style={{ color: C.ink }}>{brl(valorDe(it))}</div>
                      <div className="text-xs" style={{ color: "#C0392B", fontWeight: 700 }}>desconto {brl(descontoDe(it))}</div>
                    </>
                  ) : (
                    <div className="text-sm font-semibold" style={{ color: C.ink }}>{brl(valorDe(it))}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {it.parceria ? (
                  <span className="text-xs rounded-md px-1.5 py-0.5"
                        style={{ background: "#FBE9E7", color: "#C0392B", fontWeight: 700 }}>sem cobrança — parceria</span>
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
            <span style={{ color: C.coral }}>A receber</span>
            <span style={{ color: C.coral, fontWeight: 700 }}>{brl(totais.aReceber)}</span>
          </div>
        )}
      </Secao>

      {/* ---- alunas ---- */}
      <Secao titulo="Pagamentos de alunas" extra={pagAlunas.length ? brl(totais.recAlunas) : ""}>
        {pagAlunas.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: C.muted }}>Nenhum pagamento de aluna no período.</div>
        )}
        {pagAlunas.map((p, i) => (
          <div key={i} className="px-4 py-3 flex items-start justify-between gap-3" style={{ borderTop: `1px solid ${C.line}` }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate" style={{ color: C.ink }}>{p.aluna}</div>
              <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                {varios && p.data ? `${curto(p.data)} · ` : ""}{p.ehMatricula ? "matrícula marcada como paga" : `${p.forma || "sem forma"}${p.obs ? ` · ${p.obs}` : ""}`}
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

      <div className="text-xs leading-relaxed p-3 rounded-xl flex gap-2 ag-noprint" style={{ color: C.muted, background: C.tealSoft }}>
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
