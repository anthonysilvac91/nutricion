"use client";

import { useState, useEffect } from "react";
import { Triangle, GlassWater } from "lucide-react";
import { StatusBadge, formatResultValue, StrategyResult } from "./ResultBadge";

const VITAMINS = ["Vitamina A", "Vitamina D", "Vitamina E", "Vitamina K", "Vitamina C", "Tiamina", "Riboflavina", "Niacina", "Vitamina B6", "Folatos", "Vitamina B12", "Ác. Pantoténico", "Biotina", "Colina"];
const MINERALS = ["Calcio", "Fósforo", "Cobre", "Flúor", "Yodo", "Hierro", "Zinc", "Potasio", "Sodio", "Cloro", "Magnesio", "Selenio", "Cromo", "Manganeso", "Molibdeno"];

export interface MicrosData {
    fiberSourceId?: string;
    waterSourceId?: string;
    selectedNutrients: string[];
}

interface SourceOption { id: string; label: string; outputUnit: string; reference: { citation: string } }

interface Props {
    results?: Record<string, StrategyResult>;
    availableFormulas?: { fiberSources?: SourceOption[]; waterSources?: SourceOption[] };
    defaultData?: Partial<MicrosData>;
    onChange?: (data: MicrosData) => void;
    readOnly?: boolean;
}

function NutrientCard({ label, selected, onToggle, activeColor, activeBg, readOnly }: { label: string; selected: boolean; onToggle: () => void; activeColor: string; activeBg: string; readOnly?: boolean }) {
    return (
        <button type="button" onClick={readOnly ? undefined : onToggle}
            className={`w-full py-2.5 px-2 rounded-lg border text-[11px] font-semibold text-center transition-all select-none ${readOnly ? "cursor-default" : "cursor-pointer"} ${selected ? `${activeBg} ${activeColor} border-current shadow-sm` : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"}`}>
            {label}
        </button>
    );
}

const selectCls = "h-8 border border-gray-200 rounded-lg px-3 pr-8 text-xs font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1DBF73]/25 focus:border-[#1DBF73] transition-colors cursor-pointer disabled:bg-gray-50 disabled:cursor-default";

export function MicrosSection({ results, availableFormulas, defaultData, onChange, readOnly = false }: Props) {
    const fiberSources = availableFormulas?.fiberSources ?? [];
    const waterSources = availableFormulas?.waterSources ?? [];

    const [fiberSourceId, setFiberSourceId] = useState(defaultData?.fiberSourceId ?? fiberSources[0]?.id ?? "");
    const [waterSourceId, setWaterSourceId] = useState(defaultData?.waterSourceId ?? waterSources[0]?.id ?? "");
    const [selected, setSelected] = useState<Set<string>>(new Set(defaultData?.selectedNutrients ?? []));

    const toggle = (name: string) => setSelected(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });

    useEffect(() => {
        onChange?.({ fiberSourceId, waterSourceId, selectedNutrients: Array.from(selected) });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fiberSourceId, waterSourceId, selected]);

    const fiberResult = results?.FIBER_G;
    const waterResult = results?.WATER_ML;

    return (
        <div className="bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_4px_rgba(0,0,0,0.05),0_2px_10px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
                <div className="h-9 w-9 rounded-xl bg-teal-50 text-teal-500 flex items-center justify-center shrink-0"><Triangle className="w-4 h-4" /></div>
                <h3 className="font-bold text-gray-900 text-sm">Micronutrientes</h3>
            </div>
            <div className="shrink-0">
                <table className="w-full">
                    <thead>
                        <tr className="bg-teal-50/50 border-b border-gray-100">
                            {["Indicador", "Fuente", "Cantidad", "Estado"].map(h => (
                                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider first:pl-6 last:pr-6">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        <tr className="hover:bg-gray-50/40 transition-colors">
                            <td className="pl-6 pr-4 py-4"><div className="flex items-center gap-2.5"><div className="h-7 w-7 rounded-lg bg-teal-50 text-teal-500 flex items-center justify-center shrink-0"><Triangle className="w-3.5 h-3.5" /></div><span className="text-xs font-semibold text-gray-800">Fibra alimentaria</span></div></td>
                            <td className="px-4 py-4"><select value={fiberSourceId} disabled={readOnly} onChange={e => setFiberSourceId(e.target.value)} className={selectCls}>{fiberSources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></td>
                            <td className="px-4 py-4"><span className="text-xs font-semibold text-gray-800">{formatResultValue(fiberResult)}</span></td>
                            <td className="pl-4 pr-6 py-4"><StatusBadge result={fiberResult} /></td>
                        </tr>
                        <tr className="hover:bg-gray-50/40 transition-colors">
                            <td className="pl-6 pr-4 py-4"><div className="flex items-center gap-2.5"><div className="h-7 w-7 rounded-lg bg-sky-50 text-sky-500 flex items-center justify-center shrink-0"><GlassWater className="w-3.5 h-3.5" /></div><span className="text-xs font-semibold text-gray-800">Requerimiento hídrico</span></div></td>
                            <td className="px-4 py-4"><select value={waterSourceId} disabled={readOnly} onChange={e => setWaterSourceId(e.target.value)} className={selectCls}>{waterSources.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select></td>
                            <td className="px-4 py-4"><span className="text-xs font-semibold text-gray-800">{formatResultValue(waterResult)}</span></td>
                            <td className="pl-4 pr-6 py-4"><StatusBadge result={waterResult} /></td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="border-t border-gray-100 px-6 py-5 space-y-5">
                <div>
                    <p className="text-[10px] font-bold text-orange-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><span>🍎</span> Vitaminas</p>
                    <div className="grid grid-cols-7 gap-2">
                        {VITAMINS.map(v => <NutrientCard key={v} label={v} selected={selected.has(v)} onToggle={() => toggle(v)} activeColor="text-orange-600" activeBg="bg-orange-50" readOnly={readOnly} />)}
                    </div>
                </div>
                <div>
                    <p className="text-[10px] font-bold text-sky-500 uppercase tracking-widest mb-3 flex items-center gap-1.5"><span>💎</span> Minerales</p>
                    <div className="grid grid-cols-7 gap-2">
                        {MINERALS.map(m => <NutrientCard key={m} label={m} selected={selected.has(m)} onToggle={() => toggle(m)} activeColor="text-sky-600" activeBg="bg-sky-50" readOnly={readOnly} />)}
                    </div>
                </div>
                {selected.size > 0 && <p className="text-[10px] text-gray-400 text-right">{selected.size} seleccionado{selected.size !== 1 ? "s" : ""}</p>}
            </div>
        </div>
    );
}
