"use client";

import { useState, useMemo, useEffect } from "react";
import { Activity, Flame, Zap } from "lucide-react";

const PATIENT_HEIGHT_CM = 165;
const PATIENT_AGE       = 35;
const PATIENT_FEMALE    = true;
const PATIENT_WEIGHT    = 72.5;
const PATIENT_WEIGHT_OBJ = 60.0;
const PATIENT_FAT_PCT   = 33.57;

const PAL_OPTIONS = [
    { value: "sedentary", label: "Sedentario",           pal: 1.200 },
    { value: "light",     label: "Ligeramente activo",   pal: 1.375 },
    { value: "moderate",  label: "Moderadamente activo", pal: 1.550 },
    { value: "active",    label: "Muy activo",           pal: 1.725 },
    { value: "extra",     label: "Extra activo",         pal: 1.900 },
];

const TMB_FORMULAS = [
    { value: "katch_mcardle",    label: "Ecuación de Katch-McArdle" },
    { value: "harris_benedict",  label: "Harris-Benedict"           },
    { value: "mifflin",          label: "Mifflin-St Jeor"           },
    { value: "owen",             label: "Ecuación de Owen"          },
];

function calcTMB(weight: number, formula: string, fatPct = PATIENT_FAT_PCT): number {
    const h   = PATIENT_HEIGHT_CM;
    const age = PATIENT_AGE;
    const lbm = weight * (1 - fatPct / 100);
    switch (formula) {
        case "katch_mcardle":    return Math.round(370 + 21.6 * lbm);
        case "harris_benedict":  return PATIENT_FEMALE ? Math.round(655.1 + 9.563 * weight + 1.850 * h - 4.676 * age) : Math.round(88.362 + 13.397 * weight + 4.799 * h - 5.677 * age);
        case "mifflin":          return PATIENT_FEMALE ? Math.round(10 * weight + 6.25 * h - 5 * age - 161) : Math.round(10 * weight + 6.25 * h - 5 * age + 5);
        case "owen":             return PATIENT_FEMALE ? Math.round(795 + 7.18 * weight) : Math.round(879 + 10.2 * weight);
        default:                 return Math.round(370 + 21.6 * lbm);
    }
}

export interface EnergyData {
    palActual:  string;
    palObj:     string;
    tmbFormula: string;
}

interface Props {
    defaultData?: Partial<EnergyData>;
    onChange?:    (data: EnergyData) => void;
    readOnly?:    boolean;
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
    return <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full w-fit ${bg} ${color}`}>{label}</span>;
}

export function EnergySection({ defaultData, onChange, readOnly = false }: Props) {
    const [palActual,  setPalActual]  = useState(defaultData?.palActual  ?? "sedentary");
    const [palObj,     setPalObj]     = useState(defaultData?.palObj     ?? "sedentary");
    const [tmbFormula, setTmbFormula] = useState(defaultData?.tmbFormula ?? "katch_mcardle");

    const palActualVal = PAL_OPTIONS.find(p => p.value === palActual)?.pal ?? 1.2;
    const palObjVal    = PAL_OPTIONS.find(p => p.value === palObj)?.pal ?? 1.2;

    const tmbActual = useMemo(() => calcTMB(PATIENT_WEIGHT,     tmbFormula), [tmbFormula]);
    const tmbRef    = useMemo(() => calcTMB(PATIENT_WEIGHT_OBJ, tmbFormula), [tmbFormula]);
    const getActual = useMemo(() => Math.round(tmbActual * palActualVal), [tmbActual, palActualVal]);
    const getRef    = useMemo(() => Math.round(tmbRef    * palObjVal),    [tmbRef,    palObjVal]);

    useEffect(() => {
        onChange?.({ palActual, palObj, tmbFormula });
    }, [palActual, palObj, tmbFormula]);

    const selectCls = `h-8 border border-gray-200 rounded-lg px-3 pr-8 text-xs font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1DBF73]/25 focus:border-[#1DBF73] transition-colors cursor-pointer disabled:bg-gray-50 disabled:cursor-default`;

    return (
        <div className="h-full bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_4px_rgba(0,0,0,0.05),0_2px_10px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-[#F0FDF4] text-[#1DBF73] flex items-center justify-center shrink-0"><Flame className="w-4 h-4" /></div>
                <h3 className="font-bold text-gray-900 text-sm">Cálculo energético</h3>
            </div>
            <div className="flex-1">
                <table className="w-full h-full">
                    <thead>
                        <tr className="bg-gray-50/80 border-b border-gray-100">
                            {["Indicador", "Fórmula", "Actual", "Objetivo", "Valor de referencia"].map(h => (
                                <th key={h} className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider first:pl-6 last:pr-6">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 [&>tr:last-child>td]:pb-5">
                        <tr className="hover:bg-gray-50/40 transition-colors">
                            <td className="pl-6 pr-4 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 rounded-lg bg-green-50 text-green-500 flex items-center justify-center shrink-0"><Activity className="w-3.5 h-3.5" /></div>
                                    <span className="text-xs font-semibold text-gray-800 leading-snug">Nivel de actividad<br />física</span>
                                </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-gray-400">—</td>
                            <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                    <select value={palActual} disabled={readOnly} onChange={e => setPalActual(e.target.value)} className={selectCls}>
                                        {PAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                    <Badge label={`PAL ${palActualVal.toFixed(3)}`} bg="bg-blue-50" color="text-blue-600" />
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                    <select value={palObj} disabled={readOnly} onChange={e => setPalObj(e.target.value)} className={selectCls}>
                                        {PAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                    <Badge label={`PAL ${palObjVal.toFixed(3)}`} bg="bg-blue-50" color="text-blue-600" />
                                </div>
                            </td>
                            <td className="pl-4 pr-6 py-4 text-xs text-gray-400">—</td>
                        </tr>
                        <tr className="hover:bg-gray-50/40 transition-colors">
                            <td className="pl-6 pr-4 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 rounded-lg bg-orange-50 text-orange-400 flex items-center justify-center shrink-0"><Flame className="w-3.5 h-3.5" /></div>
                                    <span className="text-xs font-semibold text-gray-800">Metabolismo basal</span>
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <select value={tmbFormula} disabled={readOnly} onChange={e => setTmbFormula(e.target.value)} className={selectCls}>
                                    {TMB_FORMULAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                            </td>
                            <td className="px-4 py-4"><span className="text-xs font-semibold text-gray-800">{tmbActual} kcal/día</span></td>
                            <td className="px-4 py-4 text-xs text-gray-400">—</td>
                            <td className="pl-4 pr-6 py-4"><span className="text-xs font-semibold text-gray-800">{tmbRef} kcal/día</span></td>
                        </tr>
                        <tr className="hover:bg-gray-50/40 transition-colors">
                            <td className="pl-6 pr-4 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 rounded-lg bg-purple-50 text-purple-400 flex items-center justify-center shrink-0"><Zap className="w-3.5 h-3.5" /></div>
                                    <span className="text-xs font-semibold text-gray-800 leading-snug">Necesidades<br />energéticas diarias</span>
                                </div>
                            </td>
                            <td className="px-4 py-4"><span className="text-xs font-medium text-gray-500">TMB × PAL</span></td>
                            <td className="px-4 py-4"><span className="text-xs font-semibold text-gray-800">{getActual} kcal/día</span></td>
                            <td className="px-4 py-4"><span className="text-xs font-semibold text-gray-800">{getRef} kcal/día</span></td>
                            <td className="pl-4 pr-6 py-4"><span className="text-xs font-semibold text-gray-800">{getRef} kcal/día</span></td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
