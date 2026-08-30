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
  const [gerando, setGerando] = useState(false);
  const [erroArquivo, setErroArquivo] = useState("");
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


  // Gera o PDF como arquivo, em vez de depender da tela de impressao (que nao
  // abre no iPhone em modo tela cheia). Texto de verdade, nao imagem: da para
  // selecionar e copiar, e abre nativo no iPhone e no Mac.
  const VERM = [192, 57, 43];
  const CINZA = [120, 120, 120];
  const baixarPDF = async () => {
    setErroArquivo(""); setGerando(true);
    try {
      const [{ jsPDF }, auto] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const autoTable = auto.default || auto.autoTable;
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const M = 40;
      let y = 46;

      doc.setFont("helvetica", "bold"); doc.setFontSize(15);
      doc.text("Mentoria HOF — Relatório", M, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
      y += 15; doc.text(titulo, M, y);
      doc.setTextColor(0);

      const secao = (nome, head, body, opts = {}) => {
        autoTable(doc, {
          startY: y + 18,
          head: [head], body: body.length ? body : [head.map(() => "—")],
          margin: { left: M, right: M },
          styles: { font: "helvetica", fontSize: 9, cellPadding: 4, overflow: "linebreak" },
          headStyles: { fillColor: [242, 240, 238], textColor: 40, fontStyle: "bold" },
          didDrawPage: () => {},
          ...opts,
        });
        y = doc.lastAutoTable.finalY;
        if (y > 720) { doc.addPage(); y = 46; }
      };
      const tituloSecao = (t) => {
        if (y > 700) { doc.addPage(); y = 30; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(11);
        doc.text(t, M, y + 30); y += 16;
        doc.setFont("helvetica", "normal");
      };

      tituloSecao("Resumo");
      secao("resumo", ["Item", "Valor"], [
        ["Entrou no período", brl(totais.total)],
        ["    Atendimentos", brl(totais.recConsultas)],
        ["    Alunas", brl(totais.recAlunas)],
        ["Previsto (valor dos atendimentos)", brl(totais.previsto)],
        ["A receber", brl(totais.aReceber)],
        ["Parcerias (sem cobrança)", brl(totais.parcerias)],
        ["Descontos concedidos", brl(totais.descontos)],
      ], {
        columnStyles: { 1: { halign: "right" } },
        // parcerias e descontos em vermelho
        didParseCell: (d) => { if (d.section === "body" && d.row.index >= 5) { d.cell.styles.textColor = VERM; d.cell.styles.fontStyle = "bold"; } },
      });

      tituloSecao("Como foi pago");
      secao("formas", ["Forma", "Valor"], totais.porForma.map(([f, v]) => [f, brl(v)]),
        { columnStyles: { 1: { halign: "right" } } });

      tituloSecao("Entrou em cada conta");
      const linhasConta = totais.porConta.flatMap((c) => [
        { conta: c.nome, forma: "", valor: brl(c.total), destaque: true },
        ...c.formas.map(([f, v]) => ({ conta: "", forma: f, valor: brl(v), destaque: false })),
      ]);
      secao("contas", ["Conta", "Forma", "Valor"], linhasConta.map((l) => [l.conta, l.forma, l.valor]), {
        columnStyles: { 2: { halign: "right" } },
        didParseCell: (d) => { if (d.section === "body" && linhasConta[d.row.index] && linhasConta[d.row.index].destaque) d.cell.styles.fontStyle = "bold"; },
      });

      tituloSecao(`Atendimentos (${consultas.length})`);
      const linhasAt = consultas.map((it) => {
        const valorTxt = it.parceria
          ? `${brl(valorDe(it))}\nPARCERIA`
          : descontoDe(it) > 0
            ? `${brl(it.valor)}\n${brl(valorDe(it))}\ndesc. ${brl(descontoDe(it))}`
            : brl(valorDe(it));
        return [
          curto(it.date), it.time || "", it.patient || "", procsLabel(it) || "—", valorTxt,
          it.parceria ? "sem cobrança" : brl(totalPagoDe(it)),
          pagList(it).filter((x) => toNum(x.valor) > 0).map((x) => `${x.forma || "?"}${x.conta ? " " + x.conta : ""}`).join(" + "),
          saldoDe(it) > 0 ? brl(saldoDe(it)) : "",
        ];
      });
      secao("atend", ["Data", "Hora", "Paciente", "Procedimentos", "Valor", "Pago", "Forma", "Falta"], linhasAt, {
        columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 7: { halign: "right" } },
        styles: { font: "helvetica", fontSize: 8, cellPadding: 3, overflow: "linebreak" },
        didParseCell: (d) => {
          const it = consultas[d.row.index];
          if (d.section !== "body" || !it) return;
          if (it.parceria && (d.column.index === 4 || d.column.index === 5)) {
            d.cell.styles.textColor = VERM; d.cell.styles.fontStyle = "bold";
          }
          if (!it.parceria && descontoDe(it) > 0 && d.column.index === 4) d.cell.styles.textColor = VERM;
        },
      });

      tituloSecao("Pagamentos de alunas");
      secao("alunas", ["Data", "Aluna", "Forma", "Conta", "Observação", "Valor"],
        pagAlunas.map((p) => [curto(p.data || ""), p.aluna,
          p.ehMatricula ? "matrícula paga" : (p.forma || ""), p.conta || "", p.obs || "",
          p.ehMatricula ? "—" : brl(p.valor)]),
        { columnStyles: { 5: { halign: "right" } } });

      tituloSecao("Produtos");
      secao("prod", ["Produto", "Início", "Usado", "Sobrou", "Mínimo"],
        (estoque || []).map((p) => { const i0 = toNum(p.inicial), at = toNum(p.qtd);
          return [p.nome, String(i0), String(Math.max(i0 - at, 0)), String(at), String(toNum(p.min))]; }),
        { columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } } });

      const nome = `relatorio-mentoria-hof-${ini}${varios ? "_a_" + fim : ""}.pdf`;
      const blob = doc.output("blob");

      try {
        const file = new File([blob], nome, { type: "application/pdf" });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Relatório Mentoria HOF" });
          return;
        }
      } catch (e) { if (e && e.name === "AbortError") return; }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nome; a.rel = "noopener";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      setErroArquivo("Não consegui gerar o PDF neste aparelho. Me avise que eu ajusto.");
    } finally { setGerando(false); }
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
            <button onClick={() => window.print()} className="flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 font-medium"
                    style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}>
              <Printer size={15} /> Imprimir
            </button>
            <button onClick={baixarPDF} disabled={gerando}
                    className="flex items-center gap-1.5 text-sm rounded-lg px-3 py-2 font-medium"
                    style={{ background: C.ink, color: "#fff", opacity: gerando ? 0.6 : 1 }}>
              <FileDown size={15} /> {gerando ? "Gerando…" : "Baixar PDF"}
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

        <div className="text-xs mb-3 p-2.5 rounded-lg" style={{ color: C.muted, background: C.tealSoft }}>
          <b>Baixar PDF</b> gera o arquivo direto — no iPhone abre o menu de compartilhar (salvar
          nos Arquivos ou mandar no WhatsApp); no Mac vai para os Downloads. O <b>Imprimir</b>
          continua ali para quem quiser mandar direto para a impressora.
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

      {erroArquivo && (
        <div className="ag-noprint text-xs p-3 mb-3 rounded-xl flex gap-2" style={{ background: C.coralSoft, color: C.coral }}>
          <AlertCircle size={14} className="shrink-0 mt-0.5" /> <span>{erroArquivo}</span>
        </div>
      )}

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
