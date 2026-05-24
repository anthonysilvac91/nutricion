"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Search, X, SlidersHorizontal, ChevronDown,
    ChevronLeft, ChevronRight, Plus,
} from "lucide-react";
import { api } from "@/lib/api";
import type { MealFoodEntry } from "./MealContent";

interface FoodSource {
    id: string; code: string; name: string; region: string | null; type: string;
}

interface FoodItem {
    id: string; name: string; nameEs: string | null; category: string | null;
    energy: number | null; protein: number | null; carbs: number | null;
    fat: number | null; fiber: number | null;
    source: { id: string; code: string; name: string; region: string | null };
}

interface Meta { total: number; page: number; limit: number; totalPages: number }

interface RowState { quantity: number; grams: number }

interface Props {
    onAdd: (entry: MealFoodEntry) => void;
    onClose: () => void;
}

const LIMIT = 8;
const fmt = (v: number | null) => v == null ? "—" : v % 1 === 0 ? v.toString() : v.toFixed(1);

export function AddFoodPanel({ onAdd, onClose }: Props) {
    const [sources,      setSources]      = useState<FoodSource[]>([]);
    const [foods,        setFoods]        = useState<FoodItem[]>([]);
    const [meta,         setMeta]         = useState<Meta>({ total: 0, page: 1, limit: LIMIT, totalPages: 0 });
    const [query,        setQuery]        = useState("");
    const [activeSource, setActiveSource] = useState<string>("");
    const [page,         setPage]         = useState(1);
    const [loading,      setLoading]      = useState(false);
    const [srcOpen,      setSrcOpen]      = useState(false);
    const [rowStates,    setRowStates]    = useState<Record<string, RowState>>({});
    const [selectedId,   setSelectedId]   = useState<string | null>(null);

    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const srcRef        = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (srcRef.current && !srcRef.current.contains(e.target as Node)) setSrcOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    useEffect(() => {
        api.getFoodSources().then(setSources).catch(console.error);
    }, []);

    const loadFoods = useCallback(async (pg: number) => {
        setLoading(true);
        try {
            const res = await api.searchFoods({
                q:          query        || undefined,
                sourceCode: activeSource || undefined,
                page:       pg,
                limit:      LIMIT,
            });
            setFoods(res.data);
            setMeta(res.meta);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [query, activeSource]);

    useEffect(() => { loadFoods(page); }, [activeSource, page]);

    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => { setPage(1); loadFoods(1); }, 350);
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    }, [query]);

    const getRow = (foodId: string): RowState =>
        rowStates[foodId] ?? { quantity: 100, grams: 100 };

    const setQuantity = (foodId: string, raw: string) => {
        const qty = parseFloat(raw) || 0;
        setRowStates(prev => ({ ...prev, [foodId]: { quantity: qty, grams: qty } }));
    };

    const handleAdd = (food: FoodItem) => {
        const row   = getRow(food.id);
        const scale = row.grams / 100;
        const calc  = (v: number | null) =>
            v != null ? Math.round(v * scale * 10) / 10 : null;

        const entry: MealFoodEntry = {
            entryId:   `${food.id}-${Date.now()}`,
            foodId:    food.id,
            foodName:  food.nameEs ?? food.name,
            sourceCode: food.source.code,
            quantity:  row.quantity,
            unit:      "gramos",
            grams:     row.grams,
            energy:    calc(food.energy),
            fat:       calc(food.fat),
            carbs:     calc(food.carbs),
            protein:   calc(food.protein),
            fiber:     calc(food.fiber),
        };
        onAdd(entry);
    };

    const activeSrcObj = sources.find(s => s.code === activeSource);

    // Compact pagination: 1 … prev cur next … last
    const buildPages = (): (number | "…")[] => {
        const total = meta.totalPages;
        if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
        const pages: (number | "…")[] = [1];
        if (page > 3) pages.push("…");
        for (let i = Math.max(2, page - 1); i <= Math.min(total - 1, page + 1); i++) pages.push(i);
        if (page < total - 2) pages.push("…");
        pages.push(total);
        return pages;
    };

    return (
        <div className="border-b border-gray-100 bg-blue-50/30">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-blue-100/60">
                <span className="text-xs font-bold text-[#3E4C59]">Agregar nuevo alimento</span>
                <button
                    onClick={onClose}
                    className="p-1 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer rounded-lg"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-5 py-2.5 border-b border-blue-100/60">
                {/* Search */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                    <input
                        value={query}
                        onChange={e => { setQuery(e.target.value); setPage(1); }}
                        placeholder="Buscar alimento"
                        className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-xl bg-white text-[#3E4C59] outline-none focus:border-[#1DBF73] transition-colors"
                    />
                    {query && (
                        <button
                            onClick={() => setQuery("")}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Sort — visual only for now */}
                <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-all cursor-pointer whitespace-nowrap">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Ordenar po...
                    <ChevronDown className="h-3 w-3" />
                </button>

                {/* Source selector */}
                <div className="relative" ref={srcRef}>
                    <button
                        onClick={() => setSrcOpen(p => !p)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-xl transition-all cursor-pointer whitespace-nowrap ${activeSource ? "border-[#1DBF73] text-[#1DBF73] bg-green-50" : "border-gray-200 text-gray-600 bg-white hover:border-gray-300"}`}
                    >
                        {activeSrcObj ? activeSrcObj.name : "Base de datos"}
                        <ChevronDown className="h-3 w-3" />
                    </button>

                    {srcOpen && (
                        <div className="absolute top-full mt-1 right-0 z-30 bg-white border border-gray-100 rounded-xl shadow-lg py-1 w-56 max-h-80 overflow-y-auto">
                            <button
                                onClick={() => { setActiveSource(""); setSrcOpen(false); setPage(1); }}
                                className={`w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 ${!activeSource ? "font-bold text-[#1DBF73]" : "text-gray-600"}`}
                            >
                                Todas las bases de datos
                            </button>
                            <div className="border-t border-gray-50 my-1" />
                            {sources.map(src => (
                                <button
                                    key={src.code}
                                    onClick={() => { setActiveSource(src.code); setSrcOpen(false); setPage(1); }}
                                    className={`w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 transition-colors ${activeSource === src.code ? "bg-green-50 font-bold text-[#1DBF73]" : "text-gray-600"}`}
                                >
                                    {src.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="border-b border-blue-100/60 bg-white/50">
                            <th className="text-left px-5 py-2.5 font-bold text-[#3E4C59] text-[11px]">
                                Información Nutricional
                            </th>
                            <th className="text-right px-4 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wide whitespace-nowrap">Energía</th>
                            <th className="text-right px-4 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wide">Grasa</th>
                            <th className="text-right px-4 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wide whitespace-nowrap">H. Carbono</th>
                            <th className="text-right px-4 py-2.5 font-bold text-gray-500 text-[10px] uppercase tracking-wide">Proteína</th>
                            <th className="w-10" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-gray-400 text-xs">Cargando…</td>
                            </tr>
                        ) : foods.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-gray-400 text-xs">Sin resultados</td>
                            </tr>
                        ) : foods.map(food => {
                            const row      = getRow(food.id);
                            const scale    = row.grams / 100;
                            const isSelected = selectedId === food.id;

                            return (
                                <tr
                                    key={food.id}
                                    onClick={() => setSelectedId(food.id === selectedId ? null : food.id)}
                                    className={`group cursor-pointer transition-colors ${isSelected ? "bg-blue-50 outline outline-1 outline-blue-200" : "hover:bg-gray-50/70"}`}
                                >
                                    {/* Quantity + unit + food info */}
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={row.quantity}
                                                onChange={e => setQuantity(food.id, e.target.value)}
                                                onClick={e => e.stopPropagation()}
                                                className="w-14 text-xs text-center border border-gray-200 rounded-lg px-1.5 py-1 outline-none focus:border-[#1DBF73] bg-white"
                                            />
                                            <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-1 bg-white text-xs text-gray-600">
                                                <span>gramos</span>
                                                <ChevronDown className="h-3 w-3 text-gray-400" />
                                            </div>
                                            <span className="text-gray-400 text-[11px] w-9 flex-none">{row.grams}g</span>
                                            <div className="min-w-0">
                                                <p className={`font-semibold truncate max-w-48 ${isSelected ? "text-[#3E4C59]" : "text-[#3E4C59]"}`}>
                                                    {food.nameEs ?? food.name}
                                                </p>
                                                <p className="text-[10px] text-gray-400">{food.source.name}</p>
                                            </div>
                                        </div>
                                    </td>

                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                                        {food.energy != null ? `${fmt(food.energy * scale)} kcal` : "—"}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                                        {food.fat != null ? `${fmt(food.fat * scale)} g` : "—"}
                                    </td>
                                    <td className="px-4 py-2.5 text-right tabular-nums text-gray-700 whitespace-nowrap">
                                        {food.carbs != null ? `${fmt(food.carbs * scale)} g` : "—"}
                                    </td>
                                    <td className={`px-4 py-2.5 text-right tabular-nums whitespace-nowrap ${isSelected ? "font-bold text-[#3E4C59]" : "text-gray-700"}`}>
                                        {food.protein != null ? `${fmt(food.protein * scale)} g` : "—"}
                                    </td>

                                    {/* Add button */}
                                    <td className="px-2 py-2.5 text-center">
                                        <button
                                            onClick={e => { e.stopPropagation(); handleAdd(food); }}
                                            title="Agregar alimento"
                                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${isSelected
                                                ? "bg-[#1DBF73] text-white"
                                                : "text-gray-300 opacity-0 group-hover:opacity-100 hover:text-[#1DBF73] hover:bg-green-50"
                                            }`}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {meta.totalPages > 1 && (
                <div className="flex items-center justify-end gap-1 px-5 py-3 border-t border-blue-100/60">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>

                    {buildPages().map((p, i) =>
                        p === "…" ? (
                            <span key={`el-${i}`} className="w-7 text-center text-xs text-gray-400">…</span>
                        ) : (
                            <button
                                key={p}
                                onClick={() => setPage(p as number)}
                                className={`w-7 h-7 rounded-lg text-xs font-medium transition-all cursor-pointer ${page === p
                                    ? "bg-[#1DBF73] text-white"
                                    : "text-gray-500 hover:bg-gray-100"
                                }`}
                            >
                                {p}
                            </button>
                        )
                    )}

                    <button
                        onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                        disabled={page === meta.totalPages}
                        className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
