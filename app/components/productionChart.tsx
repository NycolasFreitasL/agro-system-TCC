"use client";

import { useId } from "react";
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

const numero = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

const numeroCompacto = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export default function ProductionChart({
  dados,
}: ProductionChartProps) {
  const identificador = useId().replace(/:/g, "");
  const gradienteId = `producao-${identificador}`;

  const possuiDados = dados.some((item) => item.producao > 0);

  if (!possuiDados) {
    return (
      <div className="estado-vazio flex min-h-64 flex-col items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f0ef] text-[#486d6b]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden="true"
          >
            <path d="M12 21v-9" />
            <path d="M12 14C5 14 3 10 3 5c6 0 9 3 9 9Z" />
            <path d="M12 11c0-6 3-9 9-9 0 6-3 9-9 9Z" />
            <path d="M6 21h12" />
          </svg>
        </span>

        <p className="mt-4 font-semibold text-[#244b49]">
          Nenhuma produção contabilizada
        </p>

        <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">
          O gráfico utiliza as colheitas registradas em kg ou
          toneladas dentro do período.
        </p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p className="mb-3 text-xs font-medium text-slate-500">
        Quantidade colhida (kg)
      </p>

      <div className="h-64 w-full min-w-0 sm:h-72">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart
            data={dados}
            margin={{
              top: 10,
              right: 12,
              left: 0,
              bottom: 5,
            }}
          >
            <defs>
              <linearGradient
                id={gradienteId}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#486d6b"
                  stopOpacity={0.3}
                />

                <stop
                  offset="100%"
                  stopColor="#486d6b"
                  stopOpacity={0.02}
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
              minTickGap={12}
              tickMargin={10}
              tick={{
                fill: "#64748b",
                fontSize: 11,
              }}
            />

            <YAxis
              domain={[0, "auto"]}
              width={48}
              axisLine={false}
              tickLine={false}
              tickFormatter={(valor) =>
                numeroCompacto.format(Number(valor))
              }
              tick={{
                fill: "#64748b",
                fontSize: 11,
              }}
            />

            <Tooltip
              formatter={(valor) =>
                `${numero.format(Number(valor))} kg`
              }
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
              }}
              labelStyle={{
                color: "#244b49",
                fontWeight: 600,
              }}
              itemStyle={{
                color: "#486d6b",
              }}
            />

            <Area
              type="linear"
              dataKey="producao"
              name="Colheita"
              stroke="#486d6b"
              strokeWidth={3}
              fill={`url(#${gradienteId})`}
              isAnimationActive={false}
              dot={{
                r: 3,
                fill: "#486d6b",
                stroke: "#ffffff",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5,
                fill: "#244b49",
                stroke: "#ffffff",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-4 rounded-lg border border-slate-200">
        <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-[#486d6b]">
          Consultar valores por mês
        </summary>

        <div tabIndex={0} role="region" aria-label="Tabela de produção" className="overflow-x-auto px-4 pb-4">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Quantidade colhida em quilogramas por mês
            </caption>

            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="py-2 font-semibold text-slate-600">
                  Mês
                </th>

                <th
                  scope="col"
                  className="py-2 text-right font-semibold text-slate-600"
                >
                  Colheita (kg)
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {dados.map((item) => (
                <tr key={item.mes}>
                  <td className="py-2 text-slate-600">{item.mes}</td>

                  <td className="py-2 text-right tabular-nums text-slate-800">
                    {numero.format(item.producao)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
