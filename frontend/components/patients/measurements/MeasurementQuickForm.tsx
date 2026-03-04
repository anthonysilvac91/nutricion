"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Plus } from "lucide-react";

interface Props {
    unit: string;
    onSubmit: (value: number, date: string) => Promise<void>;
    isVertical?: boolean;
}

export function MeasurementQuickForm({ unit, onSubmit, isVertical = false }: Props) {
    const today = new Date().toISOString().split('T')[0];
    const [date, setDate] = useState(today);
    const [value, setValue] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!value || isNaN(Number(value))) {
            alert("Por favor ingrese un valor válido.");
            return;
        }

        setLoading(true);
        try {
            await onSubmit(Number(value), date);
            setValue("");
        } catch (error) {
            console.error(error);
            alert("Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={`flex ${isVertical ? 'flex-col gap-4' : 'flex-row items-end gap-2'} bg-gray-50 p-4 rounded-xl border border-gray-100`}>
            {/* ROW 1: Date */}
            <div className={isVertical ? "w-full" : "w-[130px] shrink-0"}>
                <label className="text-xs text-gray-500 font-medium mb-1.5 block">Fecha</label>
                <div className="relative">
                    <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        required
                        className={`h-10 bg-white w-full rounded-lg ${isVertical ? 'px-4' : ''} [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-3 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
                    />
                </div>
            </div>

            {/* ROW 2: Value */}
            <div className={`${isVertical ? 'w-full' : 'flex-1'} relative`}>
                <label className="text-xs text-gray-500 font-medium mb-1.5 block">Valor / Medición</label>
                <div className="relative">
                    <Input
                        type="number"
                        step="0.01"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        required
                        placeholder="0.00"
                        className="h-10 bg-white pr-10 w-full rounded-lg text-lg font-medium"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">{unit}</span>
                </div>
            </div>

            {/* ROW 3: Button */}
            <div className={isVertical ? "w-full flex justify-center mt-2" : ""}>
                <Button
                    type="submit"
                    disabled={loading}
                    className={`${isVertical ? 'h-11 px-8 rounded-xl w-full sm:w-auto shadow-sm min-w-[140px]' : 'h-10 w-10 p-0 rounded-lg shrink-0'} bg-[#1DBF73] hover:bg-[#15965A] text-white flex items-center justify-center border-0`}
                    title="Agregar registro"
                >
                    {loading ? "..." : (
                        <div className="flex items-center gap-1.5">
                            <Plus className={isVertical ? "w-5 h-5 mr-1" : "w-5 h-5"} />
                            {isVertical && <span className="font-bold">Agregar</span>}
                        </div>
                    )}
                </Button>
            </div>
        </form>
    );
}
