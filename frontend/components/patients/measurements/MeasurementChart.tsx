"use client";

import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { MeasurementRecord } from "@/services/measurementsService";

interface Props {
    records: MeasurementRecord[];
    unit: string;
    heightClass?: string;
}

export function MeasurementChart({ records, unit, heightClass = "h-[250px]" }: Props) {
    // We need to sort by date ascending for the chart (oldest to newest)
    const sortedRecords = useMemo(() => {
        return [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [records]);

    if (records.length === 0) {
        return (
            <div className="h-[250px] flex items-center justify-center text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                No hay suficientes datos para generar el gráfico.
            </div>
        );
    }

    return (
        <div className={`${heightClass} w-full mt-4`}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sortedRecords} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(tick) => {
                            const d = new Date(tick);
                            return `${d.getDate()}/${d.getMonth() + 1}`;
                        }}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#9ca3af" }}
                        dy={10}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: "#9ca3af" }}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        labelFormatter={(label) => {
                            const d = new Date(label);
                            return d.toLocaleDateString();
                        }}
                        formatter={(value: any) => [`${value} ${unit}`, 'Valor']}
                    />
                    <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#1DBF73"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "#1DBF73", strokeWidth: 2, stroke: "#fff" }}
                        activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
