"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DadoProducao = {
  mes: string;
  producao: number;
};

type ProductionChartProps = {
  dados: DadoProducao[];
};

export default function ProductionChart({
  dados,
}: ProductionChartProps) {
  const possuiDados = dados.some(
    (item) => item.producao > 0,
  );

  if (!possuiDados) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-center">
        <span className="text-4xl">🌾</span>

        <p className="mt-3 font-semibold text-slate-700">
          Nenhuma produção no período
        </p>

        <p className="mt-1 text-sm text-slate-400">
          Registre colheitas em kg ou toneladas.
        </p>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <AreaChart
          data={dados}
          margin={{
            top: 10,
            right: 10,
            left: -10,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient
              id="corProducao"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="5%"
                stopColor="#15803d"
                stopOpacity={0.4}
              />

              <stop
                offset="95%"
                stopColor="#15803d"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="#e2e8f0"
          />

          <XAxis
            dataKey="mes"
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "#64748b",
              fontSize: 12,
            }}
          />

          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{
              fill: "#64748b",
              fontSize: 12,
            }}
          />

          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              boxShadow:
                "0 10px 25px rgba(15, 23, 42, 0.08)",
            }}
            labelStyle={{
              color: "#334155",
              fontWeight: 600,
            }}
          />

          <Area
            type="monotone"
            dataKey="producao"
            name="Produção (kg)"
            stroke="#15803d"
            strokeWidth={3}
            fill="url(#corProducao)"
            activeDot={{
              r: 6,
              fill: "#15803d",
              stroke: "#ffffff",
              strokeWidth: 3,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}