"use client";

import { useState, useEffect, useCallback } from "react";
import { Info, Zap, Droplets, Circle, Diamond, Leaf } from "lucide-react";
import type { Meal } from "./MealConfigModal";
import type { MealFoodEntry } from "./MealContent";

// ─── Constants ────────────────────────────────────────────────────────────────

// Placeholder daily goals — connect to planning API data later
const DAILY_GOALS = { energy: 2000, fat: 65, carbs: 250, protein: 75, fiber: 25 };

const CLR = {
    energy:  "#A855F7",
    fat:     "#F59E0B",
    carbs:   "#FB923C",
    protein: "#60A5FA",
    fiber:   "#34D399",
};

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function Ring({
    percent, size = 110, stroke = 13, color, children,
}: {
    percent: number; size?: number; stroke?: number; color: string; children?: React.ReactNode;
}) {
    const r    = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const cap  = Math.min(Math.max(percent, 0), 100);
    return (
        <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="absolute" style={{ transform: "rotate(-90deg)" }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
                <circle
                    cx={size / 2} cy={size / 2} r={r} fill="none"
                    stroke={color} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={`${(cap / 100) * circ} ${circ}`}
                    style={{ transition: "stroke-dasharray 0.5s ease" }}
                />
            </svg>
            <div className="relative z-10 flex flex-col items-center gap-0.5">{children}</div>
        </div>
    );
}

function SegmentedRing({
    segments, size = 64, stroke = 9,
}: {
    segments: { value: number; color: string }[];
    size?: number; stroke?: number;
}) {
    const r     = (size - stroke) / 2;
    const circ  = 2 * Math.PI * r;
    const total = segments.reduce((a, s) => a + s.value, 0);
    let   cum   = 0;
    return (
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F3F4F6" strokeWidth={stroke} />
            {total > 0 && segments.map((seg, i) => {
                const frac   = seg.value / total;
                const dash   = frac * circ * 0.97;
                const offset = circ - cum;
                cum += frac * circ;
                return (
                    <circle
                        key={i}
                        cx={size / 2} cy={size / 2} r={r}
                        fill="none" stroke={seg.color} strokeWidth={stroke} strokeLinecap="butt"
                        strokeDasharray={`${dash} ${circ}`}
                        strokeDashoffset={offset}
                    />
                );
            })}
        </svg>
    );
}

function Bar({ value, goal, color }: { value: number; goal: number; color: string }) {
    const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
    return (
        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: color }}
            />
        </div>
    );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MealTotals {
    mealId: string; label: string;
    energy: number; fat: number; carbs: number; protein: number; fiber: number;
}

interface Props { patientId: string; meals: Meal[] }

// ─── Component ────────────────────────────────────────────────────────────────

export function NutritionalAnalysis({ patientId, meals }: Props) {
    const [mealTotals, setMealTotals] = useState<MealTotals[]>([]);

    const loadTotals = useCallback(() => {
        const totals: MealTotals[] = meals.map(meal => {
            let entries: MealFoodEntry[] = [];
            try {
                const raw = localStorage.getItem(`meal-foods-${patientId}-${meal.id}`);
                if (raw) entries = JSON.parse(raw);
            } catch { /* ignore */ }

            const sum = (k: keyof MealFoodEntry) =>
                entries.reduce((acc, e) => acc + (typeof e[k] === "number" ? (e[k] as number) : 0), 0);

            const r = (n: number) => Math.round(n * 10) / 10;
            return {
                mealId: meal.id, label: meal.label,
                energy: r(sum("energy")), fat:     r(sum("fat")),
                carbs:  r(sum("carbs")),  protein: r(sum("protein")),
                fiber:  r(sum("fiber")),
            };
        });
        setMealTotals(totals);
    }, [patientId, meals]);

    useEffect(() => {
        loadTotals();
        const id = setInterval(loadTotals, 800);
        return () => clearInterval(id);
    }, [loadTotals]);

    const total = {
        energy:  mealTotals.reduce((a, m) => a + m.energy,  0),
        fat:     mealTotals.reduce((a, m) => a + m.fat,     0),
        carbs:   mealTotals.reduce((a, m) => a + m.carbs,   0),
        protein: mealTotals.reduce((a, m) => a + m.protein, 0),
        fiber:   mealTotals.reduce((a, m) => a + m.fiber,   0),
    };

    const energyPct    = DAILY_GOALS.energy > 0 ? Math.round((total.energy / DAILY_GOALS.energy) * 100) : 0;
    const energyLeft   = Math.max(DAILY_GOALS.energy - total.energy, 0);

    const MACROS = [
        { key: "fat"     as const, label: "Grasa",              Icon: Droplets, color: CLR.fat,     goal: DAILY_GOALS.fat     },
        { key: "carbs"   as const, label: "Hidratos de carbono", Icon: Circle,  color: CLR.carbs,   goal: DAILY_GOALS.carbs   },
        { key: "protein" as const, label: "Proteína",            Icon: Diamond, color: CLR.protein, goal: DAILY_GOALS.protein },
        { key: "fiber"   as const, label: "Fibra alimentaria",   Icon: Leaf,    color: CLR.fiber,   goal: DAILY_GOALS.fiber   },
    ];

    return (
        <div className="flex flex-col gap-3">

            {/* ── Análisis nutricional ─────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-5">

                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#3E4C59]">Análisis nutricional</h3>
                    <Info className="h-3.5 w-3.5 text-gray-300" />
                </div>

                {/* Energía */}
                <div>
                    <div className="flex items-center gap-1.5 mb-3">
                        <span className="flex items-center justify-center h-5 w-5 rounded-full bg-purple-100">
                            <Zap className="h-3 w-3 text-purple-500" />
                        </span>
                        <span className="text-xs font-semibold text-[#3E4C59]">Energía</span>
                    </div>
                    <div className="flex items-center gap-5">
                        <Ring percent={energyPct} size={110} stroke={13} color={CLR.energy}>
                            <span className="text-xl font-bold text-[#3E4C59] leading-none tabular-nums">
                                {Math.round(total.energy)}
                            </span>
                            <span className="text-[10px] text-gray-400 leading-none">kcal</span>
                            <span className="text-[11px] font-bold text-purple-500 leading-none mt-1 tabular-nums">
                                {energyPct}%
                            </span>
                            <span className="text-[9px] text-gray-400 leading-none">de la meta</span>
                        </Ring>
                        <div className="flex flex-col gap-2.5 text-xs">
                            <div>
                                <p className="text-[10px] text-gray-400 mb-0.5">Consumido</p>
                                <p className="font-bold text-[#3E4C59] tabular-nums">{Math.round(total.energy)} kcal</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-400 mb-0.5">Meta diaria</p>
                                <p className="font-bold text-[#3E4C59] tabular-nums">{DAILY_GOALS.energy.toLocaleString("es-CL")} kcal</p>
                            </div>
                            <div className="px-2.5 py-1.5 bg-gray-50 rounded-xl">
                                <p className="text-[10px] font-semibold text-gray-500 tabular-nums whitespace-nowrap">
                                    {Math.round(energyLeft).toLocaleString("es-CL")} kcal restantes
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Macro progress bars */}
                <div className="flex flex-col gap-4">
                    {MACROS.map(({ key, label, Icon, color, goal }) => {
                        const val = total[key];
                        const pct = goal > 0 ? Math.round((val / goal) * 100) : 0;
                        return (
                            <div key={key}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className="flex items-center justify-center h-5 w-5 rounded-full"
                                            style={{ background: color + "25" }}
                                        >
                                            <Icon className="h-2.5 w-2.5" style={{ color }} />
                                        </span>
                                        <span className="text-xs font-semibold text-[#3E4C59]">{label}</span>
                                    </div>
                                    <span className="text-xs font-bold text-[#3E4C59] tabular-nums">
                                        {val.toFixed(1)}{" "}
                                        <span className="font-normal text-gray-400">/ {goal} g</span>
                                    </span>
                                </div>
                                <Bar value={val} goal={goal} color={color} />
                                <p className="text-[10px] text-gray-400 mt-1">{pct}% de la meta</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Comidas del día ──────────────────────────── */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col gap-4">

                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-[#3E4C59]">Comidas del día</h3>
                    <Info className="h-3.5 w-3.5 text-gray-300" />
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {[
                        { label: "Grasa",      color: CLR.fat     },
                        { label: "H. Carbono", color: CLR.carbs   },
                        { label: "Proteína",   color: CLR.protein },
                        { label: "Fibra",      color: CLR.fiber   },
                    ].map(({ label, color }) => (
                        <div key={label} className="flex items-center gap-1">
                            <div className="h-2 w-2 rounded-full flex-none" style={{ background: color }} />
                            <span className="text-[10px] text-gray-500">{label}</span>
                        </div>
                    ))}
                </div>

                {/* Mini donuts grid */}
                <div className="grid grid-cols-4 gap-1">
                    {mealTotals.map(mt => {
                        const mealEnergyPct = total.energy > 0
                            ? Math.round((mt.energy / total.energy) * 100)
                            : 0;
                        const segments = [
                            { value: mt.fat,     color: CLR.fat     },
                            { value: mt.carbs,   color: CLR.carbs   },
                            { value: mt.protein, color: CLR.protein },
                            { value: mt.fiber,   color: CLR.fiber   },
                        ];
                        return (
                            <div key={mt.mealId} className="flex flex-col items-center gap-1">
                                <div className="relative inline-flex items-center justify-center">
                                    <SegmentedRing segments={segments} size={64} stroke={9} />
                                    <div className="absolute flex flex-col items-center">
                                        <span className="text-[11px] font-bold text-[#3E4C59] tabular-nums">
                                            {mealEnergyPct}%
                                        </span>
                                    </div>
                                </div>
                                <p className="text-[10px] font-semibold text-[#3E4C59] text-center leading-tight">
                                    {mt.label}
                                </p>
                                <p className="text-[10px] text-gray-400 tabular-nums">
                                    {Math.round(mt.energy)} kcal
                                </p>
                            </div>
                        );
                    })}
                </div>

                {/* Meta diaria */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-gray-50">
                    <div className="h-2 w-2 rounded-full bg-blue-300 flex-none" />
                    <span className="text-[10px] text-gray-400">
                        Meta diaria: <span className="font-semibold text-gray-500">{DAILY_GOALS.energy.toLocaleString("es-CL")} kcal</span>
                    </span>
                </div>
            </div>
        </div>
    );
}
