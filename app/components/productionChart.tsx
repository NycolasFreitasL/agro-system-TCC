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

const dadosProducao = [
  { mes: "Abr", producao: 12 },
  { mes: "Mai", producao: 18 },
  { mes: "Jun", producao: 15 },
  { mes: "Jul", producao: 26 },
  { mes: "Ago", producao: 23 },
  { mes: "Set", producao: 32 },
];

export default function ProductionChart() {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={dadosProducao}
          margin={{
            top: 10,
            right: 10,
            left: -20,
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
              boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
            }}
            labelStyle={{
              color: "#334155",
              fontWeight: 600,
            }}
          />

          <Area
            type="monotone"
            dataKey="producao"
            name="Produção"
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