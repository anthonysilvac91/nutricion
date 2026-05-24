"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
    Search, Plus, SlidersHorizontal, ChevronDown,
    ChevronLeft, ChevronRight, X, Settings2, Database,
} from "lucide-react";
import { api } from "@/lib/api";
import { CreateFoodModal } from "@/components/foods/CreateFoodModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FoodSource {
    id: string; code: string; name: string; region: string | null;
    type: string; description: string | null;
    _count: { foods: number };
}

interface FoodItem {
    id: string; name: string; nameEs: string | null; category: string | null;
    energy: number | null; protein: number | null; carbs: number | null;
    fat: number | null; fiber: number | null; sugar: number | null; sodium: number | null;
    userId: string | null;
    source: { id: string; code: string; name: string; region: string | null };
}

interface Meta { total: number; page: number; limit: number; totalPages: number }

// ─── Column config ────────────────────────────────────────────────────────────

const ALL_COLUMNS = [
    { key: "energy",  label: "Energía",   unit: "kcal" },
    { key: "protein", label: "Proteínas", unit: "g"    },
    { key: "carbs",   label: "H. Carbono",unit: "g"    },
    { key: "fat",     label: "Lípidos",   unit: "g"    },
    { key: "fiber",   label: "Fibra",     unit: "g"    },
    { key: "sugar",   label: "Azúcar",    unit: "g"    },
    { key: "sodium",  label: "Sodio",     unit: "mg"   },
] as const;

type ColKey = (typeof ALL_COLUMNS)[number]["key"];

const DEFAULT_VISIBLE: ColKey[] = ["energy", "protein", "carbs", "fat", "fiber"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: number | null) => (v == null ? "—" : v % 1 === 0 ? v.toString() : v.toFixed(1));

const SOURCE_TYPE_LABEL: Record<string, string> = {
    API_LIVE: "API en tiempo real",
    API_CACHED: "API con caché",
    SEEDED: "Base de datos oficial",
    ADMIN_IMPORT: "Importación manual",
    NUTRITIONIST: "Personalizados",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SourceBadge({ type }: { type: string }) {
    const colors: Record<string, string> = {
        API_LIVE: "bg-blue-50 text-blue-600",
        API_CACHED: "bg-indigo-50 text-indigo-600",
        SEEDED: "bg-green-50 text-green-700",
        ADMIN_IMPORT: "bg-amber-50 text-amber-700",
        NUTRITIONIST: "bg-purple-50 text-purple-600",
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[type] ?? "bg-gray-100 text-gray-500"}`}>
            {SOURCE_TYPE_LABEL[type] ?? type}
        </span>
    );
}

function RegionFlag({ region }: { region: string | null }) {
    return (
        <span className="inline-flex items-center justify-center h-4 min-w-5 px-1 rounded text-[9px] font-bold bg-gray-100 text-gray-500 tracking-wide">
            {region === "LATAM" ? "LA" : (region ?? "GL")}
        </span>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FoodsPage() {
    const [sources,       setSources]       = useState<FoodSource[]>([]);
    const [foods,         setFoods]         = useState<FoodItem[]>([]);
    const [meta,          setMeta]          = useState<Meta>({ total: 0, page: 1, limit: 50, totalPages: 0 });
    const [categories,    setCategories]    = useState<string[]>([]);

    const [query,         setQuery]         = useState("");
    const [activeSource,  setActiveSource]  = useState<string>("");   // "" = todas
    const [activeCategory,setActiveCategory]= useState<string>("");
    const [page,          setPage]          = useState(1);
    const [loading,       setLoading]       = useState(true);

    const [visibleCols,   setVisibleCols]   = useState<ColKey[]>(DEFAULT_VISIBLE);
    const [colPanelOpen,  setColPanelOpen]  = useState(false);
    const [srcPanelOpen,  setSrcPanelOpen]  = useState(false);
    const [catPanelOpen,  setCatPanelOpen]  = useState(false);
    const [createOpen,    setCreateOpen]    = useState(false);

    const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const colPanelRef   = useRef<HTMLDivElement>(null);
    const srcPanelRef   = useRef<HTMLDivElement>(null);
    const catPanelRef   = useRef<HTMLDivElement>(null);

    // Close panels on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (colPanelRef.current && !colPanelRef.current.contains(e.target as Node)) setColPanelOpen(false);
            if (srcPanelRef.current && !srcPanelRef.current.contains(e.target as Node)) setSrcPanelOpen(false);
            if (catPanelRef.current && !catPanelRef.current.contains(e.target as Node)) setCatPanelOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // Load sources + categories once
    useEffect(() => {
        api.getFoodSources().then(setSources).catch(console.error);
        api.getFoodCategories().then(setCategories).catch(console.error);
    }, []);

    const loadFoods = useCallback(async (pg = page) => {
        setLoading(true);
        try {
            const res = await api.searchFoods({
                q:          query || undefined,
                sourceCode: activeSource  || undefined,
                category:   activeCategory || undefined,
                page:       pg,
                limit:      50,
            });
            setFoods(res.data);
            setMeta(res.meta);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [query, activeSource, activeCategory, page]);

    // Re-fetch when filters/page change
    useEffect(() => { loadFoods(page); }, [activeSource, activeCategory, page]);

    // Debounce search query
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => { setPage(1); loadFoods(1); }, 350);
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    }, [query]);

    const activeSrcObj = sources.find(s => s.code === activeSource);

    const toggleCol = (key: ColKey) =>
        setVisibleCols(prev =>
            prev.includes(key)
                ? prev.length > 1 ? prev.filter(k => k !== key) : prev
                : [...prev, key]
        );

    const displayedCols = ALL_COLUMNS.filter(c => visibleCols.includes(c.key));

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col space-y-3">

            {/* ── Header ── */}
            <div className="flex-none flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-[#3E4C59]">Alimentos</h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {meta.total.toLocaleString("es-CL")} alimentos · valores por 100 g
                    </p>
                </div>
                <button
                    onClick={() => setCreateOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1DBF73] text-white text-xs font-bold rounded-xl hover:bg-[#19a863] transition-all shadow-sm shadow-green-100 cursor-pointer"
                >
                    <Plus className="h-4 w-4" />
                    Nuevo alimento
                </button>
            </div>

            {/* ── Toolbar ── */}
            <div className="flex-none flex flex-wrap items-center gap-2">

                {/* Search */}
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                    <input
                        value={query}
                        onChange={e => { setQuery(e.target.value); setPage(1); }}
                        placeholder="Buscar alimento…"
                        className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-xl bg-white text-[#3E4C59] outline-none focus:border-[#1DBF73] transition-colors"
                    />
                    {query && (
                        <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Category filter */}
                <div className="relative" ref={catPanelRef}>
                    <button
                        onClick={() => setCatPanelOpen(p => !p)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border rounded-xl transition-all cursor-pointer ${activeCategory ? "border-[#1DBF73] text-[#1DBF73] bg-green-50" : "border-gray-200 text-gray-500 bg-white hover:border-gray-300"}`}
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        {activeCategory || "Categoría"}
                        <ChevronDown className="h-3 w-3" />
                    </button>
                    {catPanelOpen && (
                        <div className="absolute top-full mt-1 left-0 z-30 bg-white border border-gray-100 rounded-xl shadow-lg py-1 min-w-48 max-h-64 overflow-y-auto">
                            <button
                                onClick={() => { setActiveCategory(""); setCatPanelOpen(false); setPage(1); }}
                                className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 ${!activeCategory ? "font-bold text-[#1DBF73]" : "text-gray-600"}`}
                            >
                                Todas las categorías
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => { setActiveCategory(cat); setCatPanelOpen(false); setPage(1); }}
                                    className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-50 ${activeCategory === cat ? "font-bold text-[#1DBF73]" : "text-gray-600"}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Column configurator */}
                <div className="relative" ref={colPanelRef}>
                    <button
                        onClick={() => setColPanelOpen(p => !p)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-all cursor-pointer"
                        title="Configurar columnas"
                    >
                        <Settings2 className="h-3.5 w-3.5" />
                        Columnas
                    </button>
                    {colPanelOpen && (
                        <div className="absolute top-full mt-1 right-0 z-30 bg-white border border-gray-100 rounded-xl shadow-lg py-2 w-48">
                            <p className="px-4 pb-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mostrar columnas</p>
                            {ALL_COLUMNS.map(col => (
                                <label key={col.key} className="flex items-center gap-3 px-4 py-1.5 hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={visibleCols.includes(col.key)}
                                        onChange={() => toggleCol(col.key)}
                                        className="accent-[#1DBF73] h-3.5 w-3.5"
                                    />
                                    <span className="text-xs text-gray-700">{col.label} <span className="text-gray-400">({col.unit})</span></span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {/* Source selector */}
                <div className="relative" ref={srcPanelRef}>
                    <button
                        onClick={() => setSrcPanelOpen(p => !p)}
                        className={`flex items-center gap-2 px-3 py-2 text-xs font-medium border rounded-xl transition-all cursor-pointer ${activeSource ? "border-[#1DBF73] text-[#1DBF73] bg-green-50" : "border-gray-200 text-gray-500 bg-white hover:border-gray-300"}`}
                    >
                        <Database className="h-3.5 w-3.5" />
                        {activeSrcObj ? (
                            <span className="flex items-center gap-1.5">
                                <RegionFlag region={activeSrcObj.region} />
                                <span className="max-w-32 truncate">{activeSrcObj.name}</span>
                            </span>
                        ) : "Base de datos"}
                        <ChevronDown className="h-3 w-3" />
                    </button>

                    {srcPanelOpen && (
                        <div className="absolute top-full mt-1 right-0 z-30 bg-white border border-gray-100 rounded-xl shadow-lg py-1 w-52 max-h-96 overflow-y-auto">
                            <button
                                onClick={() => { setActiveSource(""); setSrcPanelOpen(false); setPage(1); }}
                                className={`w-full text-left px-4 py-2.5 text-xs hover:bg-gray-50 ${!activeSource ? "font-bold text-[#1DBF73]" : "text-gray-600"}`}
                            >
                                Todas las bases de datos
                            </button>
                            <div className="border-t border-gray-50 my-1" />
                            {sources.map(src => (
                                <button
                                    key={src.code}
                                    onClick={() => { setActiveSource(src.code); setSrcPanelOpen(false); setPage(1); }}
                                    className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors ${activeSource === src.code ? "bg-green-50" : ""}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <RegionFlag region={src.region} />
                                        <p className={`text-xs font-semibold ${activeSource === src.code ? "text-[#1DBF73]" : "text-[#3E4C59]"}`}>
                                            {src.code === "CUSTOM" ? "Mis Alimentos" : src.code}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Source info banner ── */}
            {activeSrcObj && (
                <div className="flex-none flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5">
                    <Database className="h-4 w-4 text-blue-500 mt-0.5 flex-none" />
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-blue-800">{activeSrcObj.name}</p>
                        {activeSrcObj.description && (
                            <p className="text-[11px] text-blue-600 mt-0.5 leading-relaxed">{activeSrcObj.description}</p>
                        )}
                    </div>
                    <SourceBadge type={activeSrcObj.type} />
                </div>
            )}

            {/* ── Table ── */}
            <div className="flex-1 min-h-0 bg-white rounded-2xl border border-gray-100 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-white border-b border-gray-100 z-10">
                            <tr>
                                <th className="text-left px-5 py-3 font-bold text-gray-500 uppercase tracking-wide text-[10px] min-w-60">
                                    Alimento
                                </th>
                                {displayedCols.map(col => (
                                    <th key={col.key} className="text-right px-4 py-3 font-bold text-gray-500 uppercase tracking-wide text-[10px] whitespace-nowrap">
                                        {col.label} <span className="font-normal">({col.unit})</span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={displayedCols.length + 2} className="text-center py-16 text-gray-400 text-sm">
                                        Cargando…
                                    </td>
                                </tr>
                            ) : foods.length === 0 ? (
                                <tr>
                                    <td colSpan={displayedCols.length + 2} className="text-center py-16 text-gray-400 text-sm">
                                        {query || activeSource || activeCategory
                                            ? "Sin resultados para los filtros aplicados."
                                            : "No hay alimentos en esta base de datos."}
                                    </td>
                                </tr>
                            ) : foods.map(food => (
                                <tr key={food.id} className="hover:bg-gray-50 transition-colors group">
                                    <td className="px-5 py-3">
                                        <p className="font-semibold text-[#3E4C59] truncate max-w-56">
                                            {food.nameEs ?? food.name}
                                        </p>
                                        {food.nameEs && food.nameEs !== food.name && (
                                            <p className="text-[10px] text-gray-400 truncate">{food.name}</p>
                                        )}
                                        {food.category && (
                                            <span className="inline-block mt-0.5 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-[10px]">
                                                {food.category}
                                            </span>
                                        )}
                                    </td>
                                    {displayedCols.map(col => (
                                        <td key={col.key} className="px-4 py-3 text-right tabular-nums text-gray-700">
                                            {fmt(food[col.key] as number | null)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* ── Pagination ── */}
                {meta.totalPages > 1 && (
                    <div className="flex-none flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-white">
                        <p className="text-xs text-gray-400">
                            {((meta.page - 1) * meta.limit) + 1}–{Math.min(meta.page * meta.limit, meta.total)} de {meta.total.toLocaleString("es-CL")}
                        </p>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="text-xs text-gray-500 px-2">
                                {meta.page} / {meta.totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                                disabled={page === meta.totalPages}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <CreateFoodModal
                isOpen={createOpen}
                onClose={() => setCreateOpen(false)}
                onCreated={() => { setPage(1); loadFoods(1); }}
            />
        </div>
    );
}
