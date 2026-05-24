"use client"
import { useEffect, useMemo, useState, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Users, UserCheck, UserPlus, CalendarOff, Edit, Trash, Eye, ShieldAlert, Search, ChevronDown } from "lucide-react"
import { api } from "@/lib/api"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { NewPatientModal } from "@/components/patients/NewPatientModal"
import { getUserFromToken } from "@/lib/auth"
import { useMockMode } from "@/lib/mock-mode-context"

// ─── Mock data ─────────────────────────────────────────────────────────────────
const NOW = new Date()
const thisMonth = (d: number) => new Date(NOW.getFullYear(), NOW.getMonth(), d).toISOString()
const lastMonth = (d: number) => new Date(NOW.getFullYear(), NOW.getMonth() - 1, d).toISOString()

const MOCK_PATIENTS = [
    { id: "m1",  name: "Juan Pérez",       email: "juan.perez@mail.com",    createdAt: thisMonth(3),  nextConsultation: "15 Jun, 2025", status: "active",   lastMeasurement: "02 Jun, 2025" },
    { id: "m2",  name: "Ana Torres",       email: "ana.torres@mail.com",    createdAt: thisMonth(5),  nextConsultation: null,           status: "active",   lastMeasurement: null },
    { id: "m3",  name: "Luis Martínez",    email: "luis.m@mail.com",        createdAt: thisMonth(8),  nextConsultation: "20 Jun, 2025", status: "active",   lastMeasurement: "07 Jun, 2025" },
    { id: "m4",  name: "Carla Soto",       email: "carla.soto@mail.com",    createdAt: lastMonth(12), nextConsultation: null,           status: "active",   lastMeasurement: "18 May, 2025" },
    { id: "m5",  name: "Pedro Díaz",       email: "pedro.d@mail.com",       createdAt: lastMonth(20), nextConsultation: "25 Jun, 2025", status: "active",   lastMeasurement: "20 May, 2025" },
    { id: "m6",  name: "Valentina Rojas",  email: "val.rojas@mail.com",     createdAt: thisMonth(1),  nextConsultation: null,           status: "inactive", lastMeasurement: null },
    { id: "m7",  name: "Rodrigo Fuentes",  email: "r.fuentes@mail.com",     createdAt: lastMonth(5),  nextConsultation: "30 Jun, 2025", status: "active",   lastMeasurement: "05 May, 2025" },
    { id: "m8",  name: "Daniela Muñoz",    email: "d.munoz@mail.com",       createdAt: lastMonth(15), nextConsultation: null,           status: "active",   lastMeasurement: "15 May, 2025" },
    { id: "m9",  name: "Sebastián Vega",   email: "s.vega@mail.com",        createdAt: thisMonth(10), nextConsultation: "18 Jun, 2025", status: "active",   lastMeasurement: "10 Jun, 2025" },
    { id: "m10", name: "Camila Herrera",   email: "c.herrera@mail.com",     createdAt: lastMonth(25), nextConsultation: null,           status: "inactive", lastMeasurement: "25 Apr, 2025" },
    { id: "m11", name: "Matías González",  email: "matias.g@mail.com",      createdAt: thisMonth(2),  nextConsultation: "22 Jun, 2025", status: "active",   lastMeasurement: null },
    { id: "m12", name: "Isidora Castillo", email: "isi.castillo@mail.com",  createdAt: lastMonth(8),  nextConsultation: null,           status: "active",   lastMeasurement: "08 May, 2025" },
    { id: "m13", name: "Felipe Mora",      email: "f.mora@mail.com",        createdAt: thisMonth(7),  nextConsultation: "28 Jun, 2025", status: "active",   lastMeasurement: "06 Jun, 2025" },
    { id: "m14", name: "Javiera Pinto",    email: "javi.pinto@mail.com",    createdAt: lastMonth(18), nextConsultation: null,           status: "active",   lastMeasurement: "18 May, 2025" },
    { id: "m15", name: "Tomás Ibáñez",     email: "t.ibanez@mail.com",      createdAt: thisMonth(9),  nextConsultation: "10 Jul, 2025", status: "active",   lastMeasurement: "09 Jun, 2025" },
]

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ title, value, icon: Icon, colorClass, bgClass }: {
    title: string; value: number | string
    icon: React.ElementType; colorClass: string; bgClass: string
}) {
    return (
        <Card className="border-none shadow-sm">
            <div className="p-5 flex items-center gap-4">
                <div className={`h-11 w-11 shrink-0 rounded-full flex items-center justify-center ${bgClass} ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-xs text-gray-400 font-medium leading-tight">{title}</p>
                    <p className="text-2xl font-bold text-[#2A3547] leading-tight">{value}</p>
                </div>
            </div>
        </Card>
    )
}

// ─── Filter select ─────────────────────────────────────────────────────────────
function FilterSelect({ value, onChange, options }: {
    value: string
    onChange: (v: string) => void
    options: { value: string; label: string }[]
}) {
    return (
        <div className="relative">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="appearance-none bg-white border border-gray-200 rounded-xl text-sm text-gray-600 font-medium pl-3 pr-8 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
        </div>
    )
}

// ─── Avatar colors ─────────────────────────────────────────────────────────────
const AVATAR_BG = ["bg-blue-100 text-blue-600","bg-violet-100 text-violet-600","bg-amber-100 text-amber-600","bg-rose-100 text-rose-600","bg-teal-100 text-teal-600"]

export default function PatientsPage() {
    const router = useRouter()
    const [patients, setPatients]     = useState<any[]>([])
    const [loading, setLoading]       = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [role, setRole]             = useState<string | null>(null)
    const [isRoleChecked, setIsRoleChecked] = useState(false)

    const { isMock } = useMockMode()
    const activeData = isMock ? MOCK_PATIENTS : patients

    // Filter state
    const [search, setSearch]               = useState("")
    const [filterStatus, setFilterStatus]   = useState("all")
    const [filterConsulta, setFilterConsulta] = useState("all")
    const [sortBy, setSortBy]               = useState("newest")

    // Pagination
    const PAGE_SIZE = 10
    const [page, setPage] = useState(1)

    const resetPage = useCallback(() => setPage(1), [])

    const loadData = async () => {
        try {
            setPatients(await api.getPatients())
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        const user = getUserFromToken()
        if (user) setRole(user.role)
        setIsRoleChecked(true)
        if (user?.role !== "ADMIN") loadData()
    }, [])

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const now      = new Date()
        const active   = activeData.filter((p) => !p.status || p.status === "active" || p.status === "ACTIVE").length
        const noAppt   = activeData.filter((p) => !p.nextConsultation).length
        const newMonth = activeData.filter((p) => {
            const d = new Date(p.createdAt ?? 0)
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        }).length
        return { total: activeData.length, active, noAppt, newMonth }
    }, [activeData])

    // ── Filtered + sorted list ─────────────────────────────────────────────────
    const filtered = useMemo(() => {
        let list = [...activeData]
        if (search.trim()) {
            const q = search.toLowerCase()
            list = list.filter((p) =>
                p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
            )
        }
        if (filterStatus !== "all") {
            list = list.filter((p) => {
                const s = (p.status ?? "active").toLowerCase()
                return filterStatus === "active" ? s === "active" : s !== "active"
            })
        }
        if (filterConsulta === "programado")   list = list.filter((p) => !!p.nextConsultation)
        if (filterConsulta === "noprogramado") list = list.filter((p) => !p.nextConsultation)
        if (sortBy === "oldest") list.sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime())
        else if (sortBy === "newest") list.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
        else if (sortBy === "name") list.sort((a, b) => a.name.localeCompare(b.name))
        return list
    }, [activeData, search, filterStatus, filterConsulta, sortBy])

    // Reset to page 1 on filter change
    useEffect(() => { resetPage() }, [search, filterStatus, filterConsulta, sortBy, resetPage])

    const isLoading  = !isMock && loading
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    if (!isRoleChecked) return null

    if (role === "ADMIN") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto">
                <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                    <ShieldAlert className="h-8 w-8" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h1>
                <p className="text-gray-500 mb-8">Los administradores no tienen acceso al módulo de pacientes.</p>
                <Button onClick={() => router.push("/dashboard")} className="w-full">Volver al inicio</Button>
            </div>
        )
    }

    return (
        <div className="space-y-5">

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                    title="Total pacientes"
                    value={isLoading ? "—" : kpis.total}
                    icon={Users}
                    colorClass="text-[#1DBF73]"
                    bgClass="bg-[#E6FFFA]"
                />
                <KpiCard
                    title="Pacientes activos"
                    value={isLoading ? "—" : kpis.active}
                    icon={UserCheck}
                    colorClass="text-[#5D87FF]"
                    bgClass="bg-[#ECF2FF]"
                />
                <KpiCard
                    title="Nuevos este mes"
                    value={isLoading ? "—" : kpis.newMonth}
                    icon={UserPlus}
                    colorClass="text-[#FA896B]"
                    bgClass="bg-[#FEECE5]"
                />
                <KpiCard
                    title="Sin próxima consulta"
                    value={isLoading ? "—" : kpis.noAppt}
                    icon={CalendarOff}
                    colorClass="text-[#FFAE1F]"
                    bgClass="bg-[#FEF5E5]"
                />
            </div>

            {/* Filters + Agregar */}
            <div className="flex gap-3 items-center">
                {/* Search */}
                <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Buscar..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl text-sm pl-9 pr-4 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                </div>

                <FilterSelect
                    value={filterStatus}
                    onChange={setFilterStatus}
                    options={[
                        { value: "all",      label: "Estado: Todos" },
                        { value: "active",   label: "Activo"        },
                        { value: "inactive", label: "Inactivo"      },
                    ]}
                />
                <FilterSelect
                    value={filterConsulta}
                    onChange={setFilterConsulta}
                    options={[
                        { value: "all",          label: "Consulta: Todas" },
                        { value: "programado",   label: "Programado"      },
                        { value: "noprogramado", label: "No programado"   },
                    ]}
                />
                <FilterSelect
                    value={sortBy}
                    onChange={setSortBy}
                    options={[
                        { value: "newest", label: "Más reciente" },
                        { value: "oldest", label: "Más antiguo"  },
                        { value: "name",   label: "Nombre A–Z"   },
                    ]}
                />

                {/* Results count */}
                {!isLoading && (search || filterStatus !== "all" || filterConsulta !== "all") && (
                    <span className="text-xs text-gray-400">
                        {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
                    </span>
                )}

                <div className="ml-auto">
                    <Button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-[#1DBF73] hover:bg-[#15965A] text-white shadow-md shadow-green-100 font-bold px-6 h-10 rounded-xl flex items-center gap-2 cursor-pointer whitespace-nowrap"
                    >
                        Agregar +
                    </Button>
                </div>
            </div>

            {/* Table */}
            <Card className="overflow-hidden shadow-sm border-none bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-white text-gray-400 text-xs uppercase font-semibold border-b border-gray-100 tracking-wide">
                            <tr>
                                <th className="px-6 py-4 w-14"></th>
                                <th className="px-4 py-4">Nombre</th>
                                <th className="px-4 py-4">Email</th>
                                <th className="px-4 py-4">Última consulta</th>
                                <th className="px-4 py-4">Próxima consulta</th>
                                <th className="px-4 py-4 text-center">Estado</th>
                                <th className="px-4 py-4 text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {isLoading ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">Cargando pacientes...</td></tr>
                            ) : paginated.length > 0 ? (
                                paginated.map((patient, i) => (
                                    <tr key={patient.id} className="hover:bg-gray-50/80 transition-colors group">
                                        <td className="pl-6 py-4">
                                            <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold ${AVATAR_BG[i % AVATAR_BG.length]}`}>
                                                {patient.name.charAt(0).toUpperCase()}
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <span className="font-medium text-gray-700 text-sm">{patient.name}</span>
                                        </td>
                                        <td className="px-4 py-4 text-gray-400 text-sm">{patient.email || "—"}</td>
                                        <td className="px-4 py-4 text-gray-400 text-sm">
                                            {patient.lastMeasurement || "—"}
                                        </td>
                                        <td className="px-4 py-4">
                                            {patient.nextConsultation ? (
                                                <span className="inline-block bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                                                    {patient.nextConsultation}
                                                </span>
                                            ) : (
                                                <span className="inline-block bg-orange-100 text-orange-600 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                                                    No programado
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className="inline-block bg-green-100 text-green-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                                                Activo
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center justify-center gap-2">
                                                {/* Ver ficha */}
                                                <Link href={`/patients/${patient.id}`}>
                                                    <button className="flex items-center gap-1.5 text-xs font-semibold text-[#1DBF73] bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap">
                                                        <Eye className="h-3.5 w-3.5" /> Ver ficha
                                                    </button>
                                                </Link>
                                                <Link href={`/patients/${patient.id}/edit`}>
                                                    <button className="p-1.5 text-gray-300 hover:text-blue-500 transition-colors" title="Editar">
                                                        <Edit className="h-4 w-4" />
                                                    </button>
                                                </Link>
                                                <button
                                                    onClick={async () => {
                                                        if (confirm("¿Estás seguro de eliminar este paciente?")) {
                                                            try {
                                                                await api.deletePatient(patient.id)
                                                                loadData()
                                                            } catch {
                                                                alert("Error al eliminar")
                                                            }
                                                        }
                                                    }}
                                                    className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <Trash className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 text-sm">
                                        {search || filterStatus !== "all" || filterConsulta !== "all"
                                            ? "No se encontraron pacientes con esos filtros"
                                            : "No se encontraron pacientes"
                                        }
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Pagination */}
            {!isLoading && filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-1">
                    <p className="text-xs text-gray-400">
                        Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} pacientes
                    </p>

                    <div className="flex items-center gap-1">
                        {/* Anterior */}
                        <button
                            onClick={() => setPage((p) => p - 1)}
                            disabled={page === 1}
                            className="h-8 px-3 rounded-lg text-sm font-medium text-gray-500 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            ← Anterior
                        </button>

                        {/* Page numbers */}
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                            .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…")
                                acc.push(p)
                                return acc
                            }, [])
                            .map((p, idx) =>
                                p === "…" ? (
                                    <span key={`ellipsis-${idx}`} className="h-8 w-8 flex items-center justify-center text-xs text-gray-400">…</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setPage(p as number)}
                                        className={`h-8 w-8 rounded-lg text-sm font-semibold transition-all
                                            ${page === p
                                                ? "bg-[#1DBF73] text-white shadow-sm shadow-green-200"
                                                : "text-gray-500 hover:bg-white hover:shadow-sm"
                                            }`}
                                    >
                                        {p}
                                    </button>
                                )
                            )
                        }

                        {/* Siguiente */}
                        <button
                            onClick={() => setPage((p) => p + 1)}
                            disabled={page === totalPages}
                            className="h-8 px-3 rounded-lg text-sm font-medium text-gray-500 hover:bg-white hover:shadow-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            Siguiente →
                        </button>
                    </div>
                </div>
            )}

            <NewPatientModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={loadData}
            />
        </div>
    )
}
