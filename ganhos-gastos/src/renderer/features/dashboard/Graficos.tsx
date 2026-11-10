import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ResumoDashboard } from '@/types/api-types';
import { formatarMoeda } from '@/lib/formatar';

const CORES = [
  '#38bdf8', '#f472b6', '#facc15', '#4ade80', '#a78bfa',
  '#fb923c', '#2dd4bf', '#f87171', '#60a5fa', '#c084fc', '#34d399',
];

const ESTILOTooltip = {
  backgroundColor: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '10px',
  color: '#f1f5f9',
  fontSize: 13,
} as const;

function valorFormatado(valor: unknown): string {
  return formatarMoeda(Number(valor));
}

/** Pizza: gastos por CATEGORIA — usa o agregado da API (não recalcula no cliente). */
export function GraficoCategorias({ resumo }: { resumo: ResumoDashboard }) {
  const dados = useMemo(
    () =>
      resumo.categorias
        .filter((c) => Number(c.total) > 0)
        .map((c) => ({ nome: c.categoria, total: Number(c.total) })),
    [resumo.categorias],
  );

  if (dados.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">
        Sem gastos por categoria em {resumo.ano}.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={dados}
          dataKey="total"
          nameKey="nome"
          innerRadius={62}
          outerRadius={105}
          paddingAngle={2}
          strokeWidth={1}
          stroke="#0f172a"
        >
          {dados.map((_, i) => (
            <Cell key={i} fill={CORES[i % CORES.length]} />
          ))}
        </Pie>
        <Tooltip formatter={valorFormatado} contentStyle={ESTILOTooltip} />
        <Legend
          verticalAlign="bottom"
          height={46}
          formatter={(valor) => (
            <span style={{ color: '#cbd5e1', fontSize: 12 }}>{valor}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Colunas: gastos por MÊS (12 itens direto da API). */
export function GraficoMeses({ resumo }: { resumo: ResumoDashboard }) {
  const dados = useMemo(
    () => resumo.meses.map((m) => ({ mes: m.mes, total: Number(m.total) })),
    [resumo.meses],
  );
  const vazio = dados.every((d) => d.total === 0);

  if (vazio) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">
        Sem lançamentos em {resumo.ano}.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="mes" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} tickLine={false} />
        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
        <Tooltip
          cursor={{ fill: 'rgba(56,189,248,0.08)' }}
          formatter={valorFormatado}
          labelFormatter={(rotulo) => `Mês: ${rotulo}`}
          contentStyle={ESTILOTooltip}
        />
        <Bar dataKey="total" name="Gastos" fill="#38bdf8" radius={[6, 6, 0, 0]} maxBarSize={44} />
      </BarChart>
    </ResponsiveContainer>
  );
}
