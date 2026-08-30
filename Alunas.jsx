import React, { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, X, Settings, Check, ChevronLeft } from "lucide-react";

// Aba "Alunas": controle do pagamento do curso. Separado das consultas -
// aqui o que interessa e matricula + curso (parcelado ou a vista no Pix).

const toNum = (s) => {
  if (typeof s === "number") return s;
  if (!s) return 0;
  const c = String(s).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(c);
  return isNaN(n) ? 0 : n;
};
const brl = (v) => toNum(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pad = (n) => String(n).padStart(2, "0");
const hojeKey = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dataBR = (k) => { const [y, m, d] = String(k).split("-"); return d ? `${d}/${m}/${y}` : ""; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const FORMAS = ["Pix", "Dinheiro", "Crédito", "Débito", "Transferência"];
const CONTAS = ["Loan", "Mari"];

// Cada aluna pode ter valores proprios; vazio significa "usa o padrao do curso".
const usa = (v, padrao) => (v === "" || v === null || v === undefined ? toNum(padrao) : toNum(v));
const matriculaDe = (a, curso) => usa(a.valorMatricula, curso.matricula);
const cursoDe = (a, curso) => usa(a.valorCurso, a.modalidade === "avista" ? curso.avista : curso.parcelado);
const parcelasDe = (a, curso) => Math.max(1, parseInt(a.parcelas, 10) || parseInt(curso.maxParcelas, 10) || 1);
const valorParcelaDe = (a, curso) => cursoDe(a, curso) / parcelasDe(a, curso);

const totalDe = (a, curso) => matriculaDe(a, curso) + cursoDe(a, curso);
// A matricula marcada como paga conta sozinha, sem precisar de lancamento.
const pagoCursoDe = (a) => (a.pagamentos || []).reduce((s, p) => s + toNum(p.valor), 0);
const pagoDe = (a, curso) => (a.matriculaPaga ? matriculaDe(a, curso) : 0) + pagoCursoDe(a);
const saldoDe = (a, curso) => Math.max(totalDe(a, curso) - pagoDe(a, curso), 0);

export default function AlunasView({ alunas, curso, onSaveAlunas, onSaveCurso, C }) {
  const [tela, setTela] = useState("lista");   // lista | valores
  const [aberta, setAberta] = useState(null);  // id da aluna aberta
  const [form, setForm] = useState(null);
  const [apagar, setApagar] = useState(null);

  const totais = useMemo(() => {
    const previsto = (alunas || []).reduce((s, a) => s + totalDe(a, curso), 0);
    const recebido = (alunas || []).reduce((s, a) => s + pagoDe(a, curso), 0);
    return { previsto, recebido, aReceber: Math.max(previsto - recebido, 0) };
  }, [alunas, curso]);

  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16 };
  const input = { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 14, color: C.ink, width: "100%" };

  const salvarAluna = () => {
    const nome = (form.nome || "").trim();
    if (!nome) return;
    const base = {
      nome, telefone: form.telefone || "", modalidade: form.modalidade || "parcelado", obs: form.obs || "",
      matriculaPaga: !!form.matriculaPaga, matriculaData: form.matriculaData || "",
      valorMatricula: form.valorMatricula === "" ? "" : toNum(form.valorMatricula),
      valorCurso: form.valorCurso === "" ? "" : toNum(form.valorCurso),
      parcelas: form.parcelas === "" ? "" : Math.max(1, parseInt(form.parcelas, 10) || 1),
    };
    const next = form.id
      ? (alunas || []).map((a) => (a.id === form.id ? { ...a, ...base } : a))
      : [...(alunas || []), { ...base, id: uid(), pagamentos: [] }];
    onSaveAlunas(next);
    setForm(null);
  };

  const alunaAberta = (alunas || []).find((a) => a.id === aberta);

  if (tela === "valores") {
    return <Valores curso={curso} onSave={onSaveCurso} onVoltar={() => setTela("lista")} C={C} card={card} input={input} />;
  }

  if (alunaAberta) {
    return <Detalhe aluna={alunaAberta} curso={curso} C={C} card={card} input={input}
                    onVoltar={() => setAberta(null)}
                    onSave={(next) => onSaveAlunas((alunas || []).map((a) => (a.id === next.id ? next : a)))} />;
  }

  return (
    <div className="ag-fade">
      <div className="flex items-center justify-between mb-3">
        <div className="ff-d text-xl" style={{ fontWeight: 600 }}>Alunas</div>
        <button onClick={() => setTela("valores")} className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-2 font-medium"
                style={{ background: C.surface, color: C.muted, border: `1px solid ${C.line}` }}>
          <Settings size={14} /> Valores do curso
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <Mini label="Previsto" value={brl(totais.previsto)} C={C} />
        <Mini label="Recebido" value={brl(totais.recebido)} C={C} cor={C.goodFg} />
        <Mini label="A receber" value={brl(totais.aReceber)} C={C} cor={totais.aReceber > 0 ? C.coral : C.muted} />
      </div>

      <button onClick={() => setForm({ nome: "", telefone: "", modalidade: "parcelado", obs: "",
                                       matriculaPaga: false, matriculaData: "", valorMatricula: "", valorCurso: "", parcelas: "" })}
              className="w-full rounded-2xl py-3 font-medium flex items-center justify-center gap-2 mb-4"
              style={{ background: C.ink, color: "#fff" }}>
        <Plus size={17} /> Nova aluna
      </button>

      {(alunas || []).length === 0 && (
        <div className="text-center py-12 text-sm rounded-2xl" style={{ ...card, color: C.muted }}>
          Nenhuma aluna cadastrada ainda.
        </div>
      )}

      <div className="space-y-2">
        {(alunas || []).map((a) => {
          const total = totalDe(a, curso), pago = pagoDe(a, curso), saldo = saldoDe(a, curso);
          const quit = saldo <= 0;
          const pct = total > 0 ? Math.min((pago / total) * 100, 100) : 0;
          return (
            <div key={a.id} className="p-3.5" style={card}>
              <div className="flex items-start gap-2">
                <button onClick={() => setAberta(a.id)} className="flex-1 min-w-0 text-left">
                  <div className="font-semibold truncate" style={{ color: C.ink }}>{a.nome}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                    {a.modalidade === "avista" ? "Pix à vista" : `${parcelasDe(a, curso)}x de ${brl(valorParcelaDe(a, curso))}`}
                    {a.matriculaPaga ? " · matrícula paga" : " · matrícula em aberto"}
                    {a.telefone ? ` · ${a.telefone}` : ""}
                  </div>
                </button>
                <button onClick={() => setForm({ ...a })} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ color: C.muted, border: `1px solid ${C.line}` }} aria-label="Editar"><Pencil size={14} /></button>
                <button onClick={() => setApagar(a)} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ color: C.coral, border: `1px solid ${C.line}` }} aria-label="Remover"><Trash2 size={14} /></button>
              </div>

              <button onClick={() => setAberta(a.id)} className="w-full text-left mt-2.5">
                <div className="flex justify-between text-xs mb-1.5">
                  <span style={{ color: C.muted }}>Pago {brl(pago)} de {brl(total)}</span>
                  <span style={{ color: quit ? C.goodFg : C.coral, fontWeight: 600 }}>
                    {quit ? "quitado" : `falta ${brl(saldo)}`}
                  </span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ height: 6, background: C.bg }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: quit ? C.goodFg : C.coral, transition: "width .25s" }} />
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {form && (
        <Overlay onClose={() => setForm(null)} C={C}>
          <Topo titulo={form.id ? "Editar aluna" : "Nova aluna"} onClose={() => setForm(null)} C={C} />
          <div className="text-xs mb-1" style={{ color: C.muted }}>Nome</div>
          <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome completo" style={input} />
          <div className="text-xs mb-1 mt-3" style={{ color: C.muted }}>Telefone</div>
          <input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} placeholder="(00) 00000-0000" style={input} />

          <div className="text-xs mb-1.5 mt-3" style={{ color: C.muted }}>Forma de pagamento do curso</div>
          <div className="flex gap-2">
            {[["parcelado", `Parcelado · ${brl(curso.parcelado)}`], ["avista", `Pix à vista · ${brl(curso.avista)}`]].map(([k, l]) => (
              <button key={k} onClick={() => setForm({ ...form, modalidade: k })} className="flex-1 text-xs rounded-lg py-2.5 font-medium"
                      style={{ background: form.modalidade === k ? C.ink : C.surface, color: form.modalidade === k ? "#fff" : C.muted,
                               border: `1px solid ${form.modalidade === k ? C.ink : C.line}` }}>{l}</button>
            ))}
          </div>
          {form.modalidade === "parcelado" && (
            <label className="block mt-3">
              <div className="text-xs mb-1" style={{ color: C.muted }}>Em quantas vezes</div>
              <input inputMode="numeric" value={form.parcelas}
                     onChange={(e) => setForm({ ...form, parcelas: e.target.value.replace(/\D/g, "") })}
                     placeholder={`padrão: ${curso.maxParcelas}x`} style={input} />
              <div className="text-xs mt-1" style={{ color: C.faint }}>
                {parcelasDe(form, curso)}x de <b style={{ color: C.muted }}>{brl(valorParcelaDe(form, curso))}</b>
              </div>
            </label>
          )}

          <div className="rounded-xl p-3 mt-3" style={{ background: C.bg, border: `1px solid ${C.line}` }}>
            <div className="text-xs mb-2" style={{ color: C.muted }}>
              Valores desta aluna — deixe em branco para usar o padrão do curso
            </div>
            <div className="flex gap-2">
              <label className="flex-1">
                <div className="text-xs mb-1" style={{ color: C.muted }}>Matrícula (R$)</div>
                <input inputMode="decimal" value={form.valorMatricula}
                       onChange={(e) => setForm({ ...form, valorMatricula: e.target.value })}
                       placeholder={String(curso.matricula)} style={{ ...input, background: C.surface }} />
              </label>
              <label className="flex-1">
                <div className="text-xs mb-1" style={{ color: C.muted }}>Curso (R$)</div>
                <input inputMode="decimal" value={form.valorCurso}
                       onChange={(e) => setForm({ ...form, valorCurso: e.target.value })}
                       placeholder={String(form.modalidade === "avista" ? curso.avista : curso.parcelado)}
                       style={{ ...input, background: C.surface }} />
              </label>
            </div>
            <div className="text-xs mt-2" style={{ color: C.muted }}>
              Total desta aluna: <b style={{ color: C.ink }}>{brl(totalDe(form, curso))}</b>
            </div>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer rounded-xl p-2.5 mt-3"
                 style={{ background: form.matriculaPaga ? C.tealSoft : C.bg, border: `1px solid ${form.matriculaPaga ? C.teal + "44" : C.line}` }}>
            <input type="checkbox" checked={!!form.matriculaPaga}
                   onChange={(e) => setForm({ ...form, matriculaPaga: e.target.checked, matriculaData: e.target.checked ? (form.matriculaData || hojeKey()) : "" })}
                   className="mt-0.5" style={{ accentColor: C.teal, width: 16, height: 16 }} />
            <span className="flex-1">
              <span className="text-sm block" style={{ color: C.ink }}>Matrícula já paga</span>
              <span className="text-xs" style={{ color: C.muted }}>
                Conta {brl(matriculaDe(form, curso))} como pago, sem precisar lançar.
              </span>
            </span>
          </label>
          {form.matriculaPaga && (
            <label className="block mt-2">
              <div className="text-xs mb-1" style={{ color: C.muted }}>Quando pagou a matrícula</div>
              <input type="date" value={form.matriculaData || ""} onChange={(e) => setForm({ ...form, matriculaData: e.target.value })} style={input} />
            </label>
          )}

          <div className="text-xs mb-1 mt-3" style={{ color: C.muted }}>Observações</div>
          <input value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} placeholder="opcional" style={input} />

          <button onClick={salvarAluna} disabled={!(form.nome || "").trim()}
                  className="w-full rounded-xl py-3 font-medium mt-4"
                  style={{ background: (form.nome || "").trim() ? C.ink : C.line, color: (form.nome || "").trim() ? "#fff" : C.muted }}>
            Salvar
          </button>
        </Overlay>
      )}

      {apagar && (
        <Overlay onClose={() => setApagar(null)} C={C}>
          <div className="text-base font-medium mb-2" style={{ color: C.ink }}>Remover aluna</div>
          <div className="text-sm" style={{ color: C.muted }}>
            Apagar <b style={{ color: C.ink }}>{apagar.nome}</b> e todos os pagamentos lançados para ela?
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setApagar(null)} className="flex-1 rounded-xl py-3 font-medium"
                    style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}>Cancelar</button>
            <button onClick={() => { onSaveAlunas((alunas || []).filter((x) => x.id !== apagar.id)); setApagar(null); }}
                    className="flex-1 rounded-xl py-3 font-medium" style={{ background: C.coral, color: "#fff" }}>Remover</button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

// ------------------------------------------------------ detalhe de uma aluna
function Detalhe({ aluna, curso, onVoltar, onSave, C, card, input }) {
  const [pagForm, setPagForm] = useState(null);
  const total = totalDe(aluna, curso), pago = pagoDe(aluna, curso), saldo = saldoDe(aluna, curso);
  const pagamentos = [...(aluna.pagamentos || [])].sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const salvarPag = () => {
    const valor = toNum(pagForm.valor);
    if (valor <= 0) return;
    const reg = { id: pagForm.id || uid(), data: pagForm.data || hojeKey(), valor,
                  forma: pagForm.forma || "", conta: pagForm.conta || "", obs: pagForm.obs || "" };
    const lista = pagForm.id
      ? (aluna.pagamentos || []).map((p) => (p.id === pagForm.id ? reg : p))
      : [...(aluna.pagamentos || []), reg];
    onSave({ ...aluna, pagamentos: lista });
    setPagForm(null);
  };
  const removerPag = (id) => onSave({ ...aluna, pagamentos: (aluna.pagamentos || []).filter((p) => p.id !== id) });

  return (
    <div className="ag-fade">
      <button onClick={onVoltar} className="flex items-center gap-1 text-sm mb-3" style={{ color: C.muted }}>
        <ChevronLeft size={16} /> Alunas
      </button>

      <div className="p-4 mb-4" style={card}>
        <div className="ff-d text-lg" style={{ fontWeight: 600, color: C.ink }}>{aluna.nome}</div>
        <div className="text-xs mt-0.5" style={{ color: C.muted }}>
          {aluna.modalidade === "avista" ? "Pix à vista" : `Parcelado em ${parcelasDe(aluna, curso)}x`}
          {aluna.telefone ? ` · ${aluna.telefone}` : ""}
        </div>
        {aluna.obs ? <div className="text-xs mt-1.5" style={{ color: C.muted }}>{aluna.obs}</div> : null}

        <div className="grid grid-cols-3 gap-2 mt-3">
          <Mini label="Total" value={brl(total)} C={C} />
          <Mini label="Pago" value={brl(pago)} C={C} cor={C.goodFg} />
          <Mini label="Falta" value={brl(saldo)} C={C} cor={saldo > 0 ? C.coral : C.muted} />
        </div>

        <div className="text-xs mt-3" style={{ color: C.muted }}>
          Matrícula {brl(matriculaDe(aluna, curso))} + curso {brl(cursoDe(aluna, curso))}
          {aluna.modalidade === "parcelado"
            ? ` (${parcelasDe(aluna, curso)}x de ${brl(valorParcelaDe(aluna, curso))})`
            : ""}
        </div>

        {aluna.modalidade === "parcelado" && (
          <div className="text-xs mt-1" style={{ color: C.muted }}>
            Parcelas do curso: <b style={{ color: C.ink }}>
              {Math.min(Math.floor(pagoCursoDe(aluna) / Math.max(valorParcelaDe(aluna, curso), 1)), parcelasDe(aluna, curso))} de {parcelasDe(aluna, curso)}
            </b> pagas
          </div>
        )}

        <div className="flex items-center gap-2 mt-2.5 rounded-lg px-2.5 py-2"
             style={{ background: aluna.matriculaPaga ? C.goodBg : C.coralSoft }}>
          <span className="text-xs" style={{ color: aluna.matriculaPaga ? C.goodFg : C.coral, fontWeight: 600 }}>
            {aluna.matriculaPaga ? "Matrícula paga" : "Matrícula em aberto"}
          </span>
          <span className="text-xs" style={{ color: C.muted }}>
            {brl(matriculaDe(aluna, curso))}
            {aluna.matriculaPaga && aluna.matriculaData ? ` · ${dataBR(aluna.matriculaData)}` : ""}
          </span>
        </div>
      </div>

      <button onClick={() => setPagForm({ valor: "", data: hojeKey(), forma: "Pix", conta: "", obs: "" })}
              className="w-full rounded-2xl py-3 font-medium flex items-center justify-center gap-2 mb-4"
              style={{ background: C.ink, color: "#fff" }}>
        <Plus size={17} /> Lançar pagamento do curso
      </button>

      <div style={{ ...card, overflow: "hidden" }}>
        {pagamentos.length === 0 && (
          <div className="text-center py-10 text-sm" style={{ color: C.muted }}>Nenhum pagamento lançado.</div>
        )}
        {pagamentos.map((p, i) => (
          <div key={p.id} className="px-3.5 py-3 flex items-center gap-2" style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
            <div className="flex-1 min-w-0">
              <div className="text-sm" style={{ color: C.ink }}>{brl(p.valor)}</div>
              <div className="text-xs" style={{ color: C.muted }}>
                {dataBR(p.data)}{p.forma ? ` · ${p.forma}` : ""}{p.conta ? ` · ${p.conta}` : ""}{p.obs ? ` · ${p.obs}` : ""}
              </div>
            </div>
            <button onClick={() => setPagForm({ ...p })} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ color: C.muted, border: `1px solid ${C.line}` }} aria-label="Editar pagamento"><Pencil size={14} /></button>
            <button onClick={() => removerPag(p.id)} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ color: C.coral, border: `1px solid ${C.line}` }} aria-label="Remover pagamento"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      {pagForm && (
        <Overlay onClose={() => setPagForm(null)} C={C}>
          <Topo titulo={pagForm.id ? "Editar pagamento" : "Lançar pagamento"} onClose={() => setPagForm(null)} C={C} />
          <div className="flex gap-2">
            <label className="flex-1">
              <div className="text-xs mb-1" style={{ color: C.muted }}>Valor (R$)</div>
              <input inputMode="decimal" value={pagForm.valor} onChange={(e) => setPagForm({ ...pagForm, valor: e.target.value })}
                     placeholder="0,00" style={input} />
            </label>
            <label className="flex-1">
              <div className="text-xs mb-1" style={{ color: C.muted }}>Data</div>
              <input type="date" value={pagForm.data} onChange={(e) => setPagForm({ ...pagForm, data: e.target.value })} style={input} />
            </label>
          </div>

          <div className="text-xs mb-1.5 mt-3" style={{ color: C.muted }}>Forma</div>
          <div className="flex gap-1.5 flex-wrap">
            {FORMAS.map((x) => (
              <button key={x} onClick={() => setPagForm({ ...pagForm, forma: x })} className="text-xs rounded-lg px-3 py-1.5 font-medium"
                      style={{ background: pagForm.forma === x ? C.ink : C.surface, color: pagForm.forma === x ? "#fff" : C.muted,
                               border: `1px solid ${pagForm.forma === x ? C.ink : C.line}` }}>{x}</button>
            ))}
          </div>

          <div className="text-xs mb-1.5 mt-3" style={{ color: C.muted }}>Conta que recebeu</div>
          <div className="flex gap-1.5">
            {CONTAS.map((x) => (
              <button key={x} onClick={() => setPagForm({ ...pagForm, conta: pagForm.conta === x ? "" : x })}
                      className="flex-1 text-xs rounded-lg py-2 font-medium"
                      style={{ background: pagForm.conta === x ? C.ink : C.surface, color: pagForm.conta === x ? "#fff" : C.muted,
                               border: `1px solid ${pagForm.conta === x ? C.ink : C.line}` }}>{x}</button>
            ))}
          </div>

          <div className="text-xs mb-1 mt-3" style={{ color: C.muted }}>Observação</div>
          <input value={pagForm.obs} onChange={(e) => setPagForm({ ...pagForm, obs: e.target.value })}
                 placeholder="ex: matrícula, 1ª parcela…" style={input} />

          <button onClick={salvarPag} disabled={toNum(pagForm.valor) <= 0}
                  className="w-full rounded-xl py-3 font-medium mt-4"
                  style={{ background: toNum(pagForm.valor) > 0 ? C.ink : C.line, color: toNum(pagForm.valor) > 0 ? "#fff" : C.muted }}>
            Salvar
          </button>
        </Overlay>
      )}
    </div>
  );
}

// --------------------------------------------------------- valores do curso
function Valores({ curso, onSave, onVoltar, C, card, input }) {
  const [f, setF] = useState({
    matricula: String(curso.matricula ?? ""), parcelado: String(curso.parcelado ?? ""),
    avista: String(curso.avista ?? ""), maxParcelas: String(curso.maxParcelas ?? ""),
  });
  const [salvo, setSalvo] = useState(false);
  const salvar = () => {
    onSave({ matricula: toNum(f.matricula), parcelado: toNum(f.parcelado), avista: toNum(f.avista),
             maxParcelas: Math.max(1, parseInt(f.maxParcelas, 10) || 1) });
    setSalvo(true); setTimeout(() => setSalvo(false), 2000);
  };
  const campo = (k, label, dica) => (
    <label className="block mb-3">
      <div className="text-xs mb-1" style={{ color: C.muted }}>{label}</div>
      <input inputMode="decimal" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} style={input} />
      {dica ? <div className="text-xs mt-1" style={{ color: C.faint }}>{dica}</div> : null}
    </label>
  );

  return (
    <div className="ag-fade">
      <button onClick={onVoltar} className="flex items-center gap-1 text-sm mb-3" style={{ color: C.muted }}>
        <ChevronLeft size={16} /> Alunas
      </button>
      <div className="p-4 mb-4" style={card}>
        <div className="text-sm font-medium mb-1" style={{ color: C.ink }}>Valores do curso</div>
        <div className="text-xs mb-3" style={{ color: C.muted }}>
          Vale para todas as alunas. Mudar aqui recalcula os totais de quem já está cadastrada.
        </div>
        {campo("matricula", "Taxa de matrícula (R$)")}
        {campo("parcelado", "Curso parcelado (R$)")}
        {campo("maxParcelas", "Número máximo de parcelas", `${brl(toNum(f.parcelado) / Math.max(parseInt(f.maxParcelas, 10) || 1, 1))} por parcela`)}
        {campo("avista", "Curso à vista no Pix (R$)")}

        <div className="rounded-xl p-3 mt-1 text-xs" style={{ background: C.tealSoft, color: C.muted }}>
          Total parcelado: <b style={{ color: C.ink }}>{brl(toNum(f.matricula) + toNum(f.parcelado))}</b><br />
          Total à vista: <b style={{ color: C.ink }}>{brl(toNum(f.matricula) + toNum(f.avista))}</b>
        </div>

        <button onClick={salvar} className="w-full rounded-xl py-3 font-medium mt-4 flex items-center justify-center gap-2"
                style={{ background: C.ink, color: "#fff" }}>
          {salvo ? <><Check size={16} /> Salvo</> : "Salvar valores"}
        </button>
      </div>
    </div>
  );
}

function Mini({ label, value, C, cor }) {
  return (
    <div className="rounded-xl p-2.5" style={{ background: C.bg }}>
      <div className="text-xs mb-0.5" style={{ color: C.muted }}>{label}</div>
      <div className="text-sm font-semibold" style={{ color: cor || C.ink }}>{value}</div>
    </div>
  );
}
function Topo({ titulo, onClose, C }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="text-base font-medium" style={{ color: C.ink }}>{titulo}</div>
      <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ color: C.faint }}><X size={17} /></button>
    </div>
  );
}
function Overlay({ children, onClose, C }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "#26232a55", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
         onClick={onClose}>
      <div className="ag-pop w-full ag-scroll" style={{ maxWidth: 420, maxHeight: "90vh", overflowY: "auto", background: C.surface, borderRadius: 18, padding: 18 }}
           onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
