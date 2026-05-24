"use client";

import { useState, useMemo, useEffect } from "react";
import { Scale, Percent, BarChart2 } from "lucide-react";

const FAT_FORMULAS = [
    { value: "peterson",        label: "Ecuación de Peterson" },
    { value: "deurenberg",      label: "Ecuación de Deurenberg" },
    { value: "jackson_pollock", label: "Jackson & Pollock" },
    { value: "siri",            label: "Ecuación de Siri" },
];

const PATIENT_HEIGHT_M = 1.65;
const PATIENT_AGE      = 35;
const PATIENT_FEMALE   = true;

function calcBMI(kg: number) {
    if (!kg || kg <= 0) return 0;
    return parseFloat((kg / (PATIENT_HEIGHT_M ** 2)).toFixed(1));
}

function classifyBMI(bmi: number) {
    if (bmi < 18.5) return { label: "Bajo peso",  bg: "bg-blue-100",   color: "text-blue-700" };
    if (bmi < 25)   return { label: "Eutrofia",    bg: "bg-green-100",  color: "text-green-700" };
    if (bmi < 30)   return { label: "Sobrepeso",   bg: "bg-orange-100", color: "text-orange-700" };
    return              { label: "Obesidad",    bg: "bg-red-100",    color: "text-red-700" };
}

function calcFatPercent(kg: number, formula: string): number {
    const bmi = calcBMI(kg);
    const age = PATIENT_AGE;
    const sex = PATIENT_FEMALE ? 0 : 1;
    switch (formula) {
        case "peterson":        return parseFloat(((1.39 * bmi) + (0.16 * age) - (10.34 * sex) - 9).toFixed(2));
        case "deurenberg":      return parseFloat(((1.20 * bmi) + (0.23 * age) - (10.80 * sex) - 5.4).toFixed(2));
        case "jackson_pollock": return parseFloat(((1.29 * bmi) + (0.20 * age) - (11.40 * sex) - 8.0).toFixed(2));
        case "siri":            return parseFloat(((1.41 * bmi) + (0.18 * age) - (12.10 * sex) - 7.4).toFixed(2));
        default:                return parseFloat(((1.20 * bmi) + (0.23 * age) - (10.80 * sex) - 5.4).toFixed(2));
    }
}

const FAT_REF = PATIENT_FEMALE ? "23 – 38 %" : "10 – 25 %";
const BMI_REF = { text: "18.5 – 24.9 kg/m²", label: "Eutrofia" };

export interface PatientValuesData {
    weightActual: string;
    weightObj:    string;
    fatFormula:   string;
    fatObj:       string;
    bmiObj:       string;
}

interface Props {
    defaultData?: Partial<PatientValuesData>;
    onChange?:    (data: PatientValuesData) => void;
    readOnly?:    boolean;
}

function InputCell({ value, onChange, unit, wide = false, readOnly = false }: {
    value: string; onChange: (v: string) => void; unit: string; wide?: boolean; readOnly?: boolean;
}) {
    return (
        <div className="relative inline-flex items-center">
            <input
                type="number" step="0.1" value={value} readOnly={readOnly}
                onChange={e => onChange(e.target.value)}
                className={`${wide ? "w-32" : "w-24"} h-8 border border-gray-200 rounded-lg px-3 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1DBF73]/25 focus:border-[#1DBF73] transition-colors ${readOnly ? "bg-gray-50 cursor-default" : ""}`}
                style={{ paddingRight: `${unit.length * 7 + 12}px` }}
            />
            <span className="absolute right-2.5 text-xs text-gray-400 pointer-events-none">{unit}</span>
        </div>
    );
}

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
    return <span className={`inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-full w-fit ${bg} ${color}`}>{label}</span>;
}

export function PatientValuesSection({ defaultData, onChange, readOnly = false }: Props) {
    const [weightActual, setWeightActual] = useState(defaultData?.weightActual ?? "72.5");
    const [weightObj,    setWeightObj]    = useState(defaultData?.weightObj    ?? "60.0");
    const [fatFormula,   setFatFormula]   = useState(defaultData?.fatFormula   ?? "peterson");
    const [fatObj,       setFatObj]       = useState(defaultData?.fatObj       ?? "20.0");
    const [bmiObj,       setBmiObj]       = useState(defaultData?.bmiObj       ?? "");

    const fatActual  = useMemo(() => calcFatPercent(parseFloat(weightActual) || 0, fatFormula), [weightActual, fatFormula]);
    const bmiActual  = useMemo(() => calcBMI(parseFloat(weightActual) || 0), [weightActual]);
    const bmiActualC = classifyBMI(bmiActual);

    const bmiObjNum  = bmiObj !== "" ? parseFloat(bmiObj) : calcBMI(parseFloat(weightObj) || 0);
    const bmiObjC    = classifyBMI(bmiObjNum);

    const weightDiff = useMemo(() => {
        const diff = parseFloat(weightObj) - parseFloat(weightActual);
        return isNaN(diff) ? null : parseFloat(diff.toFixed(1));
    }, [weightActual, weightObj]);

    useEffect(() => {
        onChange?.({ weightActual, weightObj, fatFormula, fatObj, bmiObj });
    }, [weightActual, weightObj, fatFormula, fatObj, bmiObj]);

    return (
        <div className="h-full bg-white rounded-2xl border border-gray-200/70 shadow-[0_1px_4px_rgba(0,0,0,0.05),0_2px_10px_rgba(0,0,0,0.04)] overflow-hidden flex flex-col">
            <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-[#F0FDF4] text-[#1DBF73] flex items-center justify-center shrink-0">
                        <BarChart2 className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-gray-900 text-sm">Valores del paciente</h3>
                </div>
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
                                    <div className="h-7 w-7 rounded-lg bg-blue-50 text-blue-400 flex items-center justify-center shrink-0"><Scale className="w-3.5 h-3.5" /></div>
                                    <span className="text-xs font-semibold text-gray-800">Peso</span>
                                </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-gray-400">—</td>
                            <td className="px-4 py-4"><InputCell value={weightActual} onChange={setWeightActual} unit="kg" readOnly={readOnly} /></td>
                            <td className="px-4 py-4"><InputCell value={weightObj} onChange={setWeightObj} unit="kg" readOnly={readOnly} /></td>
                            <td className="pl-4 pr-6 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <span className="text-xs font-semibold text-gray-800">{weightObj || "—"} kg</span>
                                    {weightDiff !== null && weightDiff !== 0 && (
                                        <Badge
                                            label={weightDiff < 0 ? `Reducción de ${Math.abs(weightDiff)} kg` : `Aumento de ${Math.abs(weightDiff)} kg`}
                                            bg={weightDiff < 0 ? "bg-purple-100" : "bg-orange-100"}
                                            color={weightDiff < 0 ? "text-purple-700" : "text-orange-700"}
                                        />
                                    )}
                                </div>
                            </td>
                        </tr>
                        <tr className="hover:bg-gray-50/40 transition-colors">
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 rounded-lg bg-cyan-50 text-cyan-500 flex items-center justify-center shrink-0"><Percent className="w-3.5 h-3.5" /></div>
                                    <span className="text-xs font-semibold text-gray-800 leading-snug">Porcentaje de<br />masa grasa</span>
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <select value={fatFormula} disabled={readOnly} onChange={e => setFatFormula(e.target.value)}
                                    className="h-8 border border-gray-200 rounded-lg px-3 pr-8 text-xs font-medium text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#1DBF73]/25 focus:border-[#1DBF73] transition-colors cursor-pointer disabled:bg-gray-50 disabled:cursor-default">
                                    {FAT_FORMULAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                            </td>
                            <td className="px-4 py-4"><span className="text-xs font-semibold text-gray-800">{fatActual} %</span></td>
                            <td className="px-4 py-4"><InputCell value={fatObj} onChange={setFatObj} unit="%" readOnly={readOnly} /></td>
                            <td className="pl-4 pr-6 py-4"><span className="text-xs font-semibold text-gray-800">{FAT_REF}</span></td>
                        </tr>
                        <tr className="hover:bg-gray-50/40 transition-colors">
                            <td className="pl-6 pr-4 py-4">
                                <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 rounded-lg bg-orange-50 text-orange-400 flex items-center justify-center shrink-0"><BarChart2 className="w-3.5 h-3.5" /></div>
                                    <span className="text-xs font-semibold text-gray-800 leading-snug">Índice de masa<br />corporal</span>
                                </div>
                            </td>
                            <td className="px-4 py-4 text-xs text-gray-400">—</td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <div className="h-8 flex items-center"><span className="text-xs font-semibold text-gray-800">{bmiActual} kg/m²</span></div>
                                    <Badge {...bmiActualC} />
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <InputCell value={bmiObj !== "" ? bmiObj : bmiObjNum.toString()} onChange={setBmiObj} unit="kg/m²" wide readOnly={readOnly} />
                                    {bmiObjNum > 0 && <Badge {...bmiObjC} />}
                                </div>
                            </td>
                            <td className="pl-4 pr-6 py-4">
                                <div className="flex flex-col gap-1.5">
                                    <div className="h-8 flex items-center"><span className="text-xs font-semibold text-gray-800">{BMI_REF.text}</span></div>
                                    <Badge label={BMI_REF.label} bg="bg-green-100" color="text-green-700" />
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
