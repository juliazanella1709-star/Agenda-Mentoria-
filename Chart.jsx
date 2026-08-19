import React from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

// Em arquivo proprio para o recharts sair do bundle inicial: ele so e baixado
// quando a aba Faturamento e aberta (React.lazy no App.jsx).
export default function FaturamentoChart({ data, C, brl }) {
  return (
    <ResponsiveContainer>
      <BarChart data={data} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
        <XAxis dataKey="mes" tick={{ fontSize: 12, fill: C.muted }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: C.faint }} axisLine={false} tickLine={false} width={46}
               tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)} />
        <Tooltip formatter={(v) => [brl(v), "Faturado"]} cursor={{ fill: "#0000000a" }}
                 contentStyle={{ borderRadius: 12, border: `1px solid ${C.line}`, fontSize: 12 }} />
        <Bar dataKey="faturado" radius={[6, 6, 0, 0]} fill={C.coral} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}
