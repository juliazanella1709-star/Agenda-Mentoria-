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

// Cada aluna tem duas partes com valor, forma e conta proprias: a matricula e
// o restante do curso. Os campos antigos (modalidade / valorCurso /
// valorParcelado / valorAvista / parcelas) continuam sendo lidos, para nao
// perder o que ja estava cadastrado.
const branco = (v) => v === "" || v === null || v === undefined;
const usa = (v, padrao) => (branco(v) ? toNum(padrao) : toNum(v));
const textoOuVazio = (v) => (v === 0 || v ? String(v) : "");

const FORMAS_MATRICULA = ["Pix", "Dinheiro", "Débito", "Crédito"];
const FORMAS_CURSO = ["Pix", "Cartão"];
const CONTAS = ["Loan", "Mari"];

const cursoLegado = (a) => {
  const avista = a.modalidade === "avista";
  const proprio = avista ? a.valorAvista : a.valorParcelado;
  return branco(proprio) ? a.valorCurso : proprio;
};

// Visao normalizada da aluna, com o padrao do curso preenchendo o que falta.
const dadosDe = (a, curso) => {
  const m = a.matricula || {};
  const c = a.curso || {};
  return {
    matricula: {
      valor: usa(branco(m.valor) ? a.valorMatricula : m.valor, curso.matricula),
      forma: m.forma || "",
      conta: m.conta || "",
      paga: m.paga !== undefined ? !!m.paga : !!a.matriculaPaga,
      data: m.data || a.matriculaData || "",
    },
    curso: {
      valor: usa(branco(c.valor) ? cursoLegado(a) : c.valor,
                 a.modalidade === "avista" ? curso.avista : curso.parcelado),
      forma: c.forma || (a.modalidade === "avista" ? "Pix" : "Cartão"),
      parcelas: Math.max(1, parseInt(branco(c.parcelas) ? a.parcelas : c.parcelas, 10) || parseInt(curso.maxParcelas, 10) || 1),
      conta: c.conta || "",
    },
  };
};

const matriculaDe = (a, curso) => dadosDe(a, curso).matricula.valor;
const cursoDe = (a, curso) => dadosDe(a, curso).curso.valor;
const parcelasDe = (a, curso) => dadosDe(a, curso).curso.parcelas;
const valorParcelaDe = (a, curso) => {
  const d = dadosDe(a, curso);
  return d.curso.forma === "Cartão" ? d.curso.valor / d.curso.parcelas : d.curso.valor;
};
const totalDe = (a, curso) => { const d = dadosDe(a, curso); return d.matricula.valor + d.curso.valor; };
const pagoCursoDe = (a) => (a.pagamentos || []).reduce((s, p) => s + toNum(p.valor), 0);
const pagoDe = (a, curso) => { const d = dadosDe(a, curso); return (d.matricula.paga ? d.matricula.valor : 0) + pagoCursoDe(a); };
const saldoDe = (a, curso) => Math.max(totalDe(a, curso) - pagoDe(a, curso), 0);

// Como a aluna paga, em uma linha: "Pix · Loan" ou "Cartão 6x · Mari"
const resumoPagamento = (a, curso) => {
  const d = dadosDe(a, curso).curso;
  const forma = d.forma === "Cartão" ? `Cartão ${d.parcelas}x` : d.forma;
  return [forma, d.conta].filter(Boolean).join(" · ");
};

const paraForm = (a, curso) => {
  const d = dadosDe(a, curso);
  return {
    ...a,
    telefone: a.telefone || "", obs: a.obs || "",
    mValor: textoOuVazio(branco(a.matricula?.valor) && branco(a.valorMatricula) ? "" : d.matricula.valor),
    mForma: d.matricula.forma, mConta: d.matricula.conta,
    mPaga: d.matricula.paga, mData: d.matricula.data,
    cValor: textoOuVazio(branco(a.curso?.valor) && branco(cursoLegado(a)) ? "" : d.curso.valor),
    cForma: d.curso.forma, cConta: d.curso.conta, cParcelas: String(d.curso.parcelas),
  };
};

const formVazio = (turmaId, curso) => ({
  nome: "", telefone: "", obs: "", turmaId,
  mValor: "", mForma: "Pix", mConta: "", mPaga: false, mData: "",
  cValor: "", cForma: "Cartão", cConta: "", cParcelas: String(curso.maxParcelas || 6),
});

export default function AlunasView({
  alunas, turmas, curso, onSaveAlunas, onSaveTurmas, onCriarTurmaCom, onSaveCurso, C,
}) {
  const [tela, setTela] = useState("turmas");   // turmas | valores
  const [turmaAberta, setTurmaAberta] = useState(null);
  const [aberta, setAberta] = useState(null);   // id da aluna aberta
  const [form, setForm] = useState(null);
  const [apagar, setApagar] = useState(null);
  const [novaTurma, setNovaTurma] = useState(null);   // { id?, nome }
  const [apagarTurma, setApagarTurma] = useState(null);

  const semTurma = useMemo(() => (alunas || []).filter((a) => !a.turmaId), [alunas]);
  const daTurma = (tid) => (alunas || []).filter((a) => a.turmaId === tid);

  const somaDe = (lista) => {
    const previsto = lista.reduce((s, a) => s + totalDe(a, curso), 0);
    const recebido = lista.reduce((s, a) => s + pagoDe(a, curso), 0);
    return { previsto, recebido, aReceber: Math.max(previsto - recebido, 0) };
  };

  const card = { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 16 };
  const input = { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: "9px 11px", fontSize: 14, color: C.ink, width: "100%" };

  const salvarAluna = () => {
    const nome = (form.nome || "").trim();
    if (!nome) return;
    const base = {
      nome, telefone: form.telefone || "", obs: form.obs || "",
      turmaId: form.turmaId || turmaAberta || "",
      matricula: {
        valor: branco(form.mValor) ? "" : toNum(form.mValor),
        forma: form.mForma || "", conta: form.mConta || "",
        paga: !!form.mPaga, data: form.mPaga ? (form.mData || hojeKey()) : "",
      },
      curso: {
        valor: branco(form.cValor) ? "" : toNum(form.cValor),
        forma: form.cForma || "Cartão", conta: form.cConta || "",
        parcelas: Math.max(1, parseInt(form.cParcelas, 10) || 1),
      },
    };
    const next = form.id
      ? (alunas || []).map((a) => (a.id === form.id ? { ...a, ...base } : a))
      : [...(alunas || []), { ...base, id: uid(), pagamentos: [] }];
    onSaveAlunas(next);
    setForm(null);
  };

  const salvarTurma = () => {
    const nome = (novaTurma.nome || "").trim();
    if (!nome) return;
    if (novaTurma.id) {
      onSaveTurmas((turmas || []).map((t) => (t.id === novaTurma.id ? { ...t, nome } : t)));
    } else {
      onCriarTurmaCom(nome, []);
    }
    setNovaTurma(null);
  };

  const alunaAberta = (alunas || []).find((a) => a.id === aberta);
  const turma = (turmas || []).find((t) => t.id === turmaAberta);

  if (tela === "valores") {
    return <Valores curso={curso} onSave={onSaveCurso} onVoltar={() => setTela("turmas")} C={C} card={card} input={input} />;
  }

  if (alunaAberta) {
    return (
      <>
        <Detalhe aluna={alunaAberta} curso={curso} C={C} card={card} input={input}
                 onVoltar={() => setAberta(null)}
                 onEditar={() => setForm(paraForm(alunaAberta, curso))}
                 onSave={(next) => onSaveAlunas((alunas || []).map((a) => (a.id === next.id ? next : a)))} />
        {form && <FormAluna form={form} setForm={setForm} salvar={salvarAluna} curso={curso} C={C} input={input} />}
      </>
    );
  }

  // ------------------------------------------------------ dentro de uma turma
  if (turma) {
    const lista = daTurma(turma.id);
    const t = somaDe(lista);
    return (
      <div className="ag-fade">
        <button onClick={() => setTurmaAberta(null)} className="flex items-center gap-1 text-sm mb-3" style={{ color: C.muted }}>
          <ChevronLeft size={16} /> Turmas
        </button>

        <div className="flex items-center justify-between mb-3">
          <div className="ff-d text-xl" style={{ fontWeight: 600 }}>{turma.nome}</div>
          <div className="text-sm" style={{ color: C.muted }}>{lista.length} aluna(s)</div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          <Mini label="Previsto" value={brl(t.previsto)} C={C} />
          <Mini label="Recebido" value={brl(t.recebido)} C={C} cor={C.goodFg} />
          <Mini label="A receber" value={brl(t.aReceber)} C={C} cor={t.aReceber > 0 ? C.coral : C.muted} />
        </div>

        <button onClick={() => setForm(formVazio(turma.id, curso))}
                className="w-full rounded-2xl py-3 font-medium flex items-center justify-center gap-2 mb-4"
                style={{ background: C.ink, color: "#fff" }}>
          <Plus size={17} /> Nova aluna nesta turma
        </button>

        {lista.length === 0 && (
          <div className="text-center py-12 text-sm rounded-2xl" style={{ ...card, color: C.muted }}>
            Nenhuma aluna nesta turma ainda.
          </div>
        )}

        <div className="space-y-2">
          {lista.map((a) => <CartaoAluna key={a.id} a={a} curso={curso} C={C} card={card}
                                         onAbrir={() => setAberta(a.id)} onEditar={() => setForm(paraForm(a, curso))}
                                         onApagar={() => setApagar(a)} />)}
        </div>

        {form && <FormAluna form={form} setForm={setForm} salvar={salvarAluna} curso={curso} C={C} input={input} />}
        {apagar && <ConfirmaApagar aluna={apagar} onCancelar={() => setApagar(null)} C={C}
                                   onConfirmar={() => { onSaveAlunas((alunas || []).filter((x) => x.id !== apagar.id)); setApagar(null); }} />}
      </div>
    );
  }

  // --------------------------------------------------------- lista de turmas
  const geral = somaDe(alunas || []);
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
        <Mini label="Previsto" value={brl(geral.previsto)} C={C} />
        <Mini label="Recebido" value={brl(geral.recebido)} C={C} cor={C.goodFg} />
        <Mini label="A receber" value={brl(geral.aReceber)} C={C} cor={geral.aReceber > 0 ? C.coral : C.muted} />
      </div>

      <button onClick={() => setNovaTurma({ nome: "" })}
              className="w-full rounded-2xl py-3 font-medium flex items-center justify-center gap-2 mb-4"
              style={{ background: C.ink, color: "#fff" }}>
        <Plus size={17} /> Nova turma
      </button>

      {/* alunas que ainda nao estao em turma nenhuma */}
      {semTurma.length > 0 && (
        <div className="rounded-2xl p-3.5 mb-4" style={{ background: C.coralSoft, border: `1px solid ${C.coral}33` }}>
          <div className="text-sm font-medium" style={{ color: C.coral }}>
            {semTurma.length} {semTurma.length === 1 ? "aluna está" : "alunas estão"} sem turma
          </div>
          <div className="text-xs mt-1 mb-2.5" style={{ color: C.muted }}>
            São as que já estavam cadastradas antes das turmas existirem.
          </div>
          <button onClick={() => onCriarTurmaCom("Agosto de 2026", semTurma.map((a) => a.id))}
                  className="text-xs rounded-lg px-3 py-2 font-medium" style={{ background: C.coral, color: "#fff" }}>
            Criar “Agosto de 2026” com {semTurma.length === 1 ? "ela" : "elas"}
          </button>
        </div>
      )}

      {(turmas || []).length === 0 && semTurma.length === 0 && (
        <div className="text-center py-12 text-sm rounded-2xl" style={{ ...card, color: C.muted }}>
          Nenhuma turma ainda. Crie a primeira e cadastre as alunas dentro dela.
        </div>
      )}

      <div className="space-y-2">
        {(turmas || []).map((t) => {
          const lista = daTurma(t.id);
          const s = somaDe(lista);
          const pct = s.previsto > 0 ? Math.min((s.recebido / s.previsto) * 100, 100) : 0;
          return (
            <div key={t.id} className="p-3.5" style={card}>
              <div className="flex items-start gap-2">
                <button onClick={() => setTurmaAberta(t.id)} className="flex-1 min-w-0 text-left">
                  <div className="font-semibold truncate" style={{ color: C.ink }}>{t.nome}</div>
                  <div className="text-xs mt-0.5" style={{ color: C.muted }}>
                    {lista.length} {lista.length === 1 ? "aluna" : "alunas"}
                    {s.previsto > 0 ? ` · ${brl(s.recebido)} de ${brl(s.previsto)}` : ""}
                  </div>
                </button>
                <button onClick={() => setNovaTurma({ id: t.id, nome: t.nome })}
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ color: C.muted, border: `1px solid ${C.line}` }} aria-label="Renomear turma"><Pencil size={14} /></button>
                <button onClick={() => setApagarTurma(t)} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ color: C.coral, border: `1px solid ${C.line}` }} aria-label="Remover turma"><Trash2 size={14} /></button>
              </div>
              {s.previsto > 0 && (
                <button onClick={() => setTurmaAberta(t.id)} className="w-full mt-2.5">
                  <div className="rounded-full overflow-hidden" style={{ height: 6, background: C.bg }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: s.aReceber <= 0 ? C.goodFg : C.coral, transition: "width .25s" }} />
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {novaTurma && (
        <Overlay onClose={() => setNovaTurma(null)} C={C}>
          <Topo titulo={novaTurma.id ? "Renomear turma" : "Nova turma"} onClose={() => setNovaTurma(null)} C={C} />
          <div className="text-xs mb-1" style={{ color: C.muted }}>Nome da turma</div>
          <input value={novaTurma.nome} autoFocus onChange={(e) => setNovaTurma({ ...novaTurma, nome: e.target.value })}
                 onKeyDown={(e) => { if (e.key === "Enter") salvarTurma(); }}
                 placeholder="Ex: Agosto de 2026" style={input} />
          <button onClick={salvarTurma} disabled={!(novaTurma.nome || "").trim()}
                  className="w-full rounded-xl py-3 font-medium mt-4"
                  style={{ background: (novaTurma.nome || "").trim() ? C.ink : C.line,
                           color: (novaTurma.nome || "").trim() ? "#fff" : C.muted }}>Salvar</button>
        </Overlay>
      )}

      {apagarTurma && (
        <Overlay onClose={() => setApagarTurma(null)} C={C}>
          <div className="text-base font-medium mb-2" style={{ color: C.ink }}>Remover turma</div>
          <div className="text-sm" style={{ color: C.muted }}>
            Apagar <b style={{ color: C.ink }}>{apagarTurma.nome}</b>?
          </div>
          {daTurma(apagarTurma.id).length > 0 && (
            <div className="text-xs mt-2 p-2.5 rounded-lg" style={{ background: C.coralSoft, color: C.coral }}>
              As {daTurma(apagarTurma.id).length} alunas dela não são apagadas — voltam para “sem turma”.
            </div>
          )}
          <div className="flex gap-2 mt-4">
            <button onClick={() => setApagarTurma(null)} className="flex-1 rounded-xl py-3 font-medium"
                    style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}>Cancelar</button>
            <button onClick={() => {
                      onSaveAlunas((alunas || []).map((a) => (a.turmaId === apagarTurma.id ? { ...a, turmaId: "" } : a)));
                      onSaveTurmas((turmas || []).filter((t) => t.id !== apagarTurma.id));
                      setApagarTurma(null);
                    }}
                    className="flex-1 rounded-xl py-3 font-medium" style={{ background: C.coral, color: "#fff" }}>Remover</button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

// cartao de uma aluna dentro da turma
// Formulario de cadastro/edicao de aluna. A turma vem de fora (a que esta
// aberta), entao nao aparece aqui.
// Formulario da aluna: matricula e curso, cada um com valor, forma e conta.
function FormAluna({ form, setForm, salvar, curso, C, input }) {
  const ok = !!(form.nome || "").trim();
  const set = (k, v) => setForm({ ...form, [k]: v });
  const mValor = branco(form.mValor) ? toNum(curso.matricula) : toNum(form.mValor);
  const cValor = branco(form.cValor) ? toNum(curso.parcelado) : toNum(form.cValor);
  const parcelas = Math.max(1, parseInt(form.cParcelas, 10) || 1);

  const chip = (ativo) => ({
    background: ativo ? C.ink : C.surface, color: ativo ? "#fff" : C.muted,
    border: `1px solid ${ativo ? C.ink : C.line}`, borderRadius: 10, padding: "7px 12px", fontSize: 12, fontWeight: 500,
  });
  const bloco = { background: C.bg, border: `1px solid ${C.line}`, borderRadius: 14, padding: 12 };

  return (
    <Overlay onClose={() => setForm(null)} C={C}>
      <Topo titulo={form.id ? "Editar aluna" : "Nova aluna"} onClose={() => setForm(null)} C={C} />

      <div className="text-xs mb-1" style={{ color: C.muted }}>Nome</div>
      <input value={form.nome} autoFocus onChange={(e) => set("nome", e.target.value)}
             placeholder="Nome completo" style={input} />

      <div className="text-xs mb-1 mt-3" style={{ color: C.muted }}>Telefone</div>
      <input value={form.telefone} onChange={(e) => set("telefone", e.target.value)}
             placeholder="(00) 00000-0000" style={input} />

      {/* ---------------- matricula ---------------- */}
      <div className="mt-4" style={bloco}>
        <div className="text-sm font-medium mb-2" style={{ color: C.ink }}>Matrícula</div>

        <div className="text-xs mb-1" style={{ color: C.muted }}>Valor (R$)</div>
        <input inputMode="decimal" value={form.mValor} onChange={(e) => set("mValor", e.target.value)}
               placeholder={String(curso.matricula)} style={{ ...input, background: C.surface }} />

        <div className="text-xs mb-1.5 mt-2.5" style={{ color: C.muted }}>Forma</div>
        <div className="flex gap-1.5 flex-wrap">
          {FORMAS_MATRICULA.map((f) => (
            <button key={f} onClick={() => set("mForma", form.mForma === f ? "" : f)} style={chip(form.mForma === f)}>{f}</button>
          ))}
        </div>

        <div className="text-xs mb-1.5 mt-2.5" style={{ color: C.muted }}>Conta que recebe</div>
        <div className="flex gap-1.5">
          {CONTAS.map((c) => (
            <button key={c} onClick={() => set("mConta", form.mConta === c ? "" : c)}
                    style={{ ...chip(form.mConta === c), flex: 1 }}>{c}</button>
          ))}
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer mt-3">
          <input type="checkbox" checked={!!form.mPaga}
                 onChange={(e) => setForm({ ...form, mPaga: e.target.checked, mData: e.target.checked ? (form.mData || hojeKey()) : "" })}
                 style={{ accentColor: C.teal, width: 16, height: 16 }} />
          <span className="text-sm" style={{ color: C.ink }}>Já paga ({brl(mValor)})</span>
        </label>
        {form.mPaga && (
          <input type="date" value={form.mData || ""} onChange={(e) => set("mData", e.target.value)}
                 style={{ ...input, background: C.surface, marginTop: 8 }} />
        )}
      </div>

      {/* ---------------- curso ---------------- */}
      <div className="mt-3" style={bloco}>
        <div className="text-sm font-medium mb-2" style={{ color: C.ink }}>Restante do curso</div>

        <div className="text-xs mb-1" style={{ color: C.muted }}>Valor (R$)</div>
        <input inputMode="decimal" value={form.cValor} onChange={(e) => set("cValor", e.target.value)}
               placeholder={String(curso.parcelado)} style={{ ...input, background: C.surface }} />

        <div className="text-xs mb-1.5 mt-2.5" style={{ color: C.muted }}>Forma</div>
        <div className="flex gap-1.5">
          {FORMAS_CURSO.map((f) => (
            <button key={f} onClick={() => set("cForma", f)} style={{ ...chip(form.cForma === f), flex: 1 }}>{f}</button>
          ))}
        </div>

        {form.cForma === "Cartão" && (
          <>
            <div className="text-xs mb-1.5 mt-2.5" style={{ color: C.muted }}>Em quantas vezes</div>
            <div className="flex gap-1.5 flex-wrap">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button key={n} onClick={() => set("cParcelas", String(n))} style={chip(parcelas === n)}>{n}x</button>
              ))}
            </div>
            <div className="text-xs mt-1.5" style={{ color: C.faint }}>
              {parcelas}x de <b style={{ color: C.muted }}>{brl(cValor / parcelas)}</b>
            </div>
          </>
        )}

        <div className="text-xs mb-1.5 mt-2.5" style={{ color: C.muted }}>Conta que recebe</div>
        <div className="flex gap-1.5">
          {CONTAS.map((c) => (
            <button key={c} onClick={() => set("cConta", form.cConta === c ? "" : c)}
                    style={{ ...chip(form.cConta === c), flex: 1 }}>{c}</button>
          ))}
        </div>
      </div>

      <div className="text-xs mt-3 p-2.5 rounded-lg" style={{ background: C.tealSoft, color: C.muted }}>
        Total desta aluna: <b style={{ color: C.ink }}>{brl(mValor + cValor)}</b>
        <span style={{ color: C.faint }}> — matrícula {brl(mValor)} + curso {brl(cValor)}</span>
      </div>

      <div className="text-xs mb-1 mt-3" style={{ color: C.muted }}>Observações</div>
      <input value={form.obs} onChange={(e) => set("obs", e.target.value)} placeholder="opcional" style={input} />

      <button onClick={salvar} disabled={!ok} className="w-full rounded-xl py-3 font-medium mt-4"
              style={{ background: ok ? C.ink : C.line, color: ok ? "#fff" : C.muted }}>Salvar</button>
    </Overlay>
  );
}

function CartaoAluna({ a, curso, C, card, onAbrir, onEditar, onApagar }) {
  const total = totalDe(a, curso), pago = pagoDe(a, curso), saldo = saldoDe(a, curso);
  const quit = saldo <= 0;
  const pct = total > 0 ? Math.min((pago / total) * 100, 100) : 0;
  return (
    <div className="p-3.5" style={card}>
      <div className="flex items-start gap-2">
        <button onClick={onAbrir} className="flex-1 min-w-0 text-left">
          <div className="font-semibold truncate" style={{ color: C.ink }}>{a.nome}</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>
            {resumoPagamento(a, curso) || "sem forma definida"}
            {dadosDe(a, curso).matricula.paga ? " · matrícula paga" : " · matrícula em aberto"}
            {a.telefone ? ` · ${a.telefone}` : ""}
          </div>
        </button>
        <button onClick={onEditar} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ color: C.muted, border: `1px solid ${C.line}` }} aria-label="Editar"><Pencil size={14} /></button>
        <button onClick={onApagar} className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ color: C.coral, border: `1px solid ${C.line}` }} aria-label="Remover"><Trash2 size={14} /></button>
      </div>
      <button onClick={onAbrir} className="w-full text-left mt-2.5">
        <div className="flex justify-between text-xs mb-1.5">
          <span style={{ color: C.muted }}>Pago {brl(pago)} de {brl(total)}</span>
          <span style={{ color: quit ? C.goodFg : C.coral, fontWeight: 600 }}>{quit ? "quitado" : `falta ${brl(saldo)}`}</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 6, background: C.bg }}>
          <div style={{ height: "100%", width: `${pct}%`, background: quit ? C.goodFg : C.coral, transition: "width .25s" }} />
        </div>
      </button>
    </div>
  );
}

function ConfirmaApagar({ aluna, onCancelar, onConfirmar, C }) {
  return (
    <Overlay onClose={onCancelar} C={C}>
      <div className="text-base font-medium mb-2" style={{ color: C.ink }}>Remover aluna</div>
      <div className="text-sm" style={{ color: C.muted }}>
        Apagar <b style={{ color: C.ink }}>{aluna.nome}</b> e todos os pagamentos lançados para ela?
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={onCancelar} className="flex-1 rounded-xl py-3 font-medium"
                style={{ background: C.surface, color: C.ink, border: `1px solid ${C.line}` }}>Cancelar</button>
        <button onClick={onConfirmar} className="flex-1 rounded-xl py-3 font-medium"
                style={{ background: C.coral, color: "#fff" }}>Remover</button>
      </div>
    </Overlay>
  );
}

// ------------------------------------------------------ detalhe de uma aluna
function Detalhe({ aluna, curso, onVoltar, onEditar, onSave, C, card, input }) {
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
          {resumoPagamento(aluna, curso) || "sem forma definida"}
          {aluna.telefone ? ` · ${aluna.telefone}` : ""}
        </div>
        {aluna.obs ? <div className="text-xs mt-1.5" style={{ color: C.muted }}>{aluna.obs}</div> : null}

        <div className="grid grid-cols-3 gap-2 mt-3">
          <Mini label="Total" value={brl(total)} C={C} />
          <Mini label="Pago" value={brl(pago)} C={C} cor={C.goodFg} />
          <Mini label="Falta" value={brl(saldo)} C={C} cor={saldo > 0 ? C.coral : C.muted} />
        </div>

        <button onClick={onEditar} className="w-full text-xs rounded-lg py-2 mt-3 font-medium flex items-center justify-center gap-1.5"
                style={{ background: C.bg, color: C.ink, border: `1px solid ${C.line}` }}>
          <Pencil size={12} /> Editar valores e forma de pagamento
        </button>

        <div className="rounded-xl mt-3" style={{ border: `1px solid ${C.line}`, overflow: "hidden" }}>
          {[
            ["Matrícula", dadosDe(aluna, curso).matricula, null],
            ["Curso", dadosDe(aluna, curso).curso, true],
          ].map(([rotulo, d, ehCurso], i) => (
            <div key={rotulo} className="px-3 py-2 flex items-center justify-between gap-2"
                 style={{ borderTop: i === 0 ? "none" : `1px solid ${C.line}` }}>
              <span className="text-xs" style={{ color: C.muted }}>
                {rotulo}
                {d.forma ? ` · ${ehCurso && d.forma === "Cartão" ? `Cartão ${d.parcelas}x` : d.forma}` : ""}
                {d.conta ? ` · ${d.conta}` : ""}
              </span>
              <span className="text-sm" style={{ color: C.ink }}>
                {brl(d.valor)}
                {ehCurso && d.forma === "Cartão" && d.parcelas > 1 && (
                  <span className="text-xs" style={{ color: C.faint }}> ({brl(d.valor / d.parcelas)}/mês)</span>
                )}
              </span>
            </div>
          ))}
        </div>

        {dadosDe(aluna, curso).curso.forma === "Cartão" && (
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
