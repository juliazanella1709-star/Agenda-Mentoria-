import React, { useState, useMemo } from "react";
import { Download, FileSpreadsheet, AlertCircle } from "lucide-react";

// Aba "Exportar". Em arquivo proprio e carregada sob demanda (React.lazy no
// App.jsx) porque a biblioteca de Excel e pesada e so serve aqui.

// --- helpers (replicados do App.jsx de proposito: importar de la criaria
// --- um ciclo de import com o React.lazy) ---------------------------------
const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toNum = (s) => {
  if (typeof s === "number") return s;
  if (!s) return 0;
  const clean = String(s).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
};
const valorDe = (it) => toNum(it.valor);
const pagList = (it) => (it.pagamentos && it.pagamentos.length)
  ? it.pagamentos
  : (toNum(it.sinal) > 0 ? [{ valor: it.sinal, forma: it.formaPgto, conta: it.sinalPara, parcelas: it.parcelas }] : []);
const totalPagoDe = (it) => pagList(it).reduce((s, p) => s + toNum(p.valor), 0);
const saldoDe = (it) => (it && it.parceria ? 0 : Math.max(valorDe(it) - totalPagoDe(it), 0));
const procsLabel = (it) => [it && it.procedure, ...(((it && it.procedures) || []))].filter(Boolean).join(" + ");
const brl = (v) => toNum(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (k) => { const [y, m, d] = String(k).split("-"); return `${d}/${m}/${y}`; };

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho",
  "Agosto","Setembro","Outubro","Novembro","Dezembro"];

const STATUS_LABEL = { pendente: "Pendente", confirmado: "Confirmado", concluido: "Concluído", cancelado: "Cancelado" };

export default function ExportView({ items, estoque, C }) {
  const hoje = new Date();
  const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const [de, setDe] = useState(keyOf(ini));
  const [ate, setAte] = useState(keyOf(fim));
  const [incCancelados, setIncCancelados] = useState(false);
  const [abas, setAbas] = useState({ consultas: true, pagamentos: true, produtos: true, resumo: true });
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");

  const toggleAba = (k) => setAbas((p) => ({ ...p, [k]: !p[k] }));

  const preset = (delta) => {
    const base = new Date(hoje.getFullYear(), hoje.getMonth() + delta, 1);
    setDe(keyOf(base));
    setAte(keyOf(new Date(base.getFullYear(), base.getMonth() + 1, 0)));
  };

  // Consultas no periodo (comparacao de string funciona: as chaves sao YYYY-MM-DD)
  const filtradas = useMemo(() => {
    return (items || [])
      .filter((it) => it.date >= de && it.date <= ate)
      .filter((it) => (incCancelados ? true : it.status !== "cancelado"))
      .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  }, [items, de, ate, incCancelados]);

  const linhasPag = useMemo(() => {
    const out = [];
    for (const it of filtradas) {
      for (const p of pagList(it)) {
        if (toNum(p.valor) > 0) out.push({ it, p });
      }
    }
    return out;
  }, [filtradas]);

  const totais = useMemo(() => {
    const valor = filtradas.reduce((s, it) => s + valorDe(it), 0);
    const pago = filtradas.reduce((s, it) => s + totalPagoDe(it), 0);
    const parcerias = filtradas.filter((it) => it.parceria).reduce((s, it) => s + valorDe(it), 0);
    return { valor, pago, parcerias, saldo: filtradas.reduce((s, it) => s + saldoDe(it), 0) };
  }, [filtradas]);

  const nadaSelecionado = !Object.values(abas).some(Boolean);
  const periodoInvalido = !de || !ate || de > ate;

  const gerar = async () => {
    setErro("");
    setGerando(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();

      if (abas.consultas) {
        const linhas = filtradas.map((it) => {
          const pgs = pagList(it).filter((p) => toNum(p.valor) > 0);
          return {
            "Data": dataBR(it.date),
            "Hora": it.time || "",
            "Paciente": it.patient || "",
            "Telefone": it.phone || "",
            "Procedimentos": procsLabel(it),
            "Valor (R$)": valorDe(it),
            "Pago (R$)": totalPagoDe(it),
            "Saldo (R$)": saldoDe(it),
            "Parceria": it.parceria ? "SIM" : "",
            "Formas de pagamento": pgs.map((p) => p.forma || "?").join(" + "),
            "Contas": pgs.map((p) => p.conta || "").filter(Boolean).join(" + "),
            "Status": STATUS_LABEL[it.status] || it.status || "",
            "Observações": it.notes || "",
          };
        });
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Consultas");
      }

      if (abas.pagamentos) {
        // Uma linha por pagamento: e o formato que a contabilidade consegue somar
        // direto, sem desmembrar consulta que foi paga em duas formas.
        const linhas = linhasPag.map(({ it, p }) => ({
          "Data": dataBR(it.date),
          "Paciente": it.patient || "",
          "Procedimentos": procsLabel(it),
          "Forma": p.forma || "",
          "Conta": p.conta || "",
          "Parcelas": p.parcelas ? `${p.parcelas}x` : "",
          "Valor (R$)": toNum(p.valor),
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Pagamentos");
      }

      if (abas.produtos) {
        const linhas = (estoque || []).map((i) => ({
          "Produto": i.nome || "",
          "Quantidade inicial": toNum(i.inicial),
          "Quantidade atual": toNum(i.qtd),
          "Consumido": Math.max(toNum(i.inicial) - toNum(i.qtd), 0),
          "Mínimo": toNum(i.min),
          "Abaixo do mínimo": toNum(i.qtd) <= toNum(i.min) ? "SIM" : "",
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Produtos");
      }

      if (abas.resumo) {
        const porForma = {};
        for (const { p } of linhasPag) {
          const k = p.forma || "(sem forma)";
          porForma[k] = (porForma[k] || 0) + toNum(p.valor);
        }
        const porConta = {};
        for (const { p } of linhasPag) {
          const k = p.conta || "(sem conta)";
          porConta[k] = (porConta[k] || 0) + toNum(p.valor);
        }
        const porProc = {};
        for (const it of filtradas) {
          const k = procsLabel(it) || "(sem procedimento)";
          porProc[k] = (porProc[k] || 0) + valorDe(it);
        }
        const linhas = [
          { "Item": "Período", "Valor": `${dataBR(de)} a ${dataBR(ate)}` },
          { "Item": "Consultas no período", "Valor": filtradas.length },
          { "Item": "Valor total (R$)", "Valor": totais.valor },
          { "Item": "Total recebido (R$)", "Valor": totais.pago },
          { "Item": "Saldo a receber (R$)", "Valor": totais.saldo },
          { "Item": "Parcerias no período (R$)", "Valor": totais.parcerias },
          { "Item": "", "Valor": "" },
          { "Item": "— Recebido por forma —", "Valor": "" },
          ...Object.entries(porForma).map(([k, v]) => ({ "Item": k, "Valor": v })),
          { "Item": "", "Valor": "" },
          { "Item": "— Recebido por conta —", "Valor": "" },
          ...Object.entries(porConta).map(([k, v]) => ({ "Item": k, "Valor": v })),
          { "Item": "", "Valor": "" },
          { "Item": "— Valor por procedimento —", "Valor": "" },
          ...Object.entries(porProc).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ "Item": k, "Valor": v })),
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhas), "Resumo");
      }

      const nome = `mentoria-hof-${de}_a_${ate}.xlsx`;
      XLSX.writeFile(wb, nome);
    } catch (e) {
      setErro("Não consegui gerar o arquivo. Tente de novo; se persistir, me avise.");
    } finally {
      setGerando(false);
    }
  };

  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16 };
  const input = { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 14, color: C.ink, width: "100%" };

  return (
    <div className="ag-fade">
      <div className="p-4 mb-4" style={card}>
        <div className="text-sm font-medium mb-1" style={{ color: C.ink }}>Período</div>
        <div className="text-xs mb-3" style={{ color: C.muted }}>Escolha as datas que quer mandar para a contabilidade.</div>

        <div className="flex gap-2 mb-3">
          <button onClick={() => preset(0)} className="text-xs rounded-lg px-3 py-1.5 font-medium"
                  style={{ background: C.tealSoft, color: C.teal, border: `1px solid ${C.line}` }}>Este mês</button>
          <button onClick={() => preset(-1)} className="text-xs rounded-lg px-3 py-1.5 font-medium"
                  style={{ background: C.tealSoft, color: C.teal, border: `1px solid ${C.line}` }}>Mês passado</button>
        </div>

        <div className="flex gap-2">
          <label className="flex-1">
            <div className="text-xs mb-1" style={{ color: C.muted }}>De</div>
            <input type="date" value={de} onChange={(e) => setDe(e.target.value)} style={input} />
          </label>
          <label className="flex-1">
            <div className="text-xs mb-1" style={{ color: C.muted }}>Até</div>
            <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} style={input} />
          </label>
        </div>

        {periodoInvalido && (
          <div className="text-xs mt-2" style={{ color: C.coral }}>A data inicial precisa ser anterior à final.</div>
        )}
      </div>

      <div className="p-4 mb-4" style={card}>
        <div className="text-sm font-medium mb-1" style={{ color: C.ink }}>O que incluir</div>
        <div className="text-xs mb-3" style={{ color: C.muted }}>Cada item vira uma aba na planilha.</div>

        {[
          ["consultas", "Consultas", "uma linha por atendimento, com valor, pagamento e status"],
          ["pagamentos", "Pagamentos", "uma linha por pagamento — melhor para a contabilidade somar"],
          ["produtos", "Produtos (estoque)", "quantidade inicial, atual e consumida"],
          ["resumo", "Resumo", "totais do período, por forma, conta e procedimento"],
        ].map(([k, titulo, desc]) => (
          <label key={k} className="flex items-start gap-2.5 py-2 cursor-pointer">
            <input type="checkbox" checked={abas[k]} onChange={() => toggleAba(k)} className="mt-0.5" style={{ accentColor: C.coral, width: 16, height: 16 }} />
            <span>
              <span className="text-sm block" style={{ color: C.ink }}>{titulo}</span>
              <span className="text-xs" style={{ color: C.muted }}>{desc}</span>
            </span>
          </label>
        ))}

        <div style={{ borderTop: `1px solid ${C.line}` }} className="mt-2 pt-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" checked={incCancelados} onChange={() => setIncCancelados((v) => !v)} style={{ accentColor: C.coral, width: 16, height: 16 }} />
            <span className="text-sm" style={{ color: C.ink }}>Incluir consultas canceladas</span>
          </label>
        </div>
      </div>

      <div className="p-4 mb-4" style={card}>
        <div className="text-sm font-medium mb-3" style={{ color: C.ink }}>Prévia do período</div>
        <div className="grid grid-cols-2 gap-3">
          <Info label="Consultas" value={String(filtradas.length)} C={C} />
          <Info label="Pagamentos" value={String(linhasPag.length)} C={C} />
          <Info label="Valor total" value={brl(totais.valor)} C={C} />
          <Info label="Recebido" value={brl(totais.pago)} C={C} />
        </div>
      </div>

      {erro && (
        <div className="p-3 mb-4 rounded-xl text-sm flex items-start gap-2" style={{ background: C.coralSoft, color: C.coral }}>
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> <span>{erro}</span>
        </div>
      )}

      <button onClick={gerar} disabled={gerando || nadaSelecionado || periodoInvalido || filtradas.length === 0}
              className="w-full rounded-2xl py-3.5 font-medium flex items-center justify-center gap-2"
              style={{
                background: (gerando || nadaSelecionado || periodoInvalido || filtradas.length === 0) ? C.line : C.ink,
                color: (gerando || nadaSelecionado || periodoInvalido || filtradas.length === 0) ? C.muted : "#fff",
              }}>
        {gerando ? <>Gerando…</> : <><Download size={17} /> Baixar Excel (.xlsx)</>}
      </button>

      {filtradas.length === 0 && !periodoInvalido && (
        <div className="text-xs text-center mt-3" style={{ color: C.muted }}>Nenhuma consulta nesse período.</div>
      )}
      {nadaSelecionado && (
        <div className="text-xs text-center mt-3" style={{ color: C.muted }}>Selecione ao menos uma aba para incluir.</div>
      )}

      <div className="text-xs mt-5 leading-relaxed p-3 rounded-xl" style={{ color: C.muted, background: C.tealSoft }}>
        <FileSpreadsheet size={14} className="inline mr-1 -mt-0.5" />
        A aba <b>Produtos</b> traz o estoque geral do consultório, não o que foi usado em cada
        consulta — hoje o sistema não registra esse vínculo. Para a contabilidade ver produto
        por atendimento, é preciso passar a anotar o consumo na hora de fechar a consulta.
      </div>
    </div>
  );
}

function Info({ label, value, C }) {
  return (
    <div className="rounded-xl p-3" style={{ background: C.bg }}>
      <div className="text-xs mb-0.5" style={{ color: C.muted }}>{label}</div>
      <div className="text-sm font-medium" style={{ color: C.ink }}>{value}</div>
    </div>
  );
}
