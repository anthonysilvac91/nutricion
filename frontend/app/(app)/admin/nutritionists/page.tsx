"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ShieldAlert, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { NutritionistsFilters } from "@/components/admin/nutritionists/NutritionistsFilters"
import { NutritionistsTable } from "@/components/admin/nutritionists/NutritionistsTable"
import { NutritionistEditDrawer } from "@/components/admin/nutritionists/NutritionistEditDrawer"

import { Nutritionist, nutritionistsService } from "@/services/nutritionistsService"
import { getUserFromToken } from "@/lib/auth"
import { useMockMode } from "@/lib/mock-mode-context"

const MOCK_NUTRITIONISTS: Nutritionist[] = [
    { id: "n1", email: "carolina.reyes@nutriapp.cl",  subscriptionStatus: "ACTIVE",   trialEndsAt: null,           patientsCount: 24, createdAt: "2024-03-10T10:00:00Z" },
    { id: "n2", email: "andres.mora@nutriapp.cl",     subscriptionStatus: "ACTIVE",   trialEndsAt: null,           patientsCount: 18, createdAt: "2024-05-22T09:30:00Z" },
    { id: "n3", email: "valentina.soto@nutriapp.cl",  subscriptionStatus: "TRIALING", trialEndsAt: "2026-06-15T00:00:00Z", patientsCount: 5,  createdAt: "2026-05-01T08:00:00Z" },
    { id: "n4", email: "jorge.fuentes@nutriapp.cl",   subscriptionStatus: "EXPIRED",  trialEndsAt: null,           patientsCount: 31, createdAt: "2023-11-18T14:20:00Z" },
    { id: "n5", email: "isadora.vega@nutriapp.cl",    subscriptionStatus: "ACTIVE",   trialEndsAt: null,           patientsCount: 12, createdAt: "2024-08-07T11:45:00Z" },
    { id: "n6", email: "roberto.salas@nutriapp.cl",   subscriptionStatus: "BLOCKED",  trialEndsAt: null,           patientsCount: 0,  createdAt: "2023-06-30T16:00:00Z" },
]

export default function AdminNutritionistsPage() {
    const router = useRouter()
    const { isMock } = useMockMode()
    const [role, setRole] = useState<string | null>(null)
    const [isRoleChecked, setIsRoleChecked] = useState(false)

    // Other states
    const [nutritionists, setNutritionists] = useState<Nutritionist[]>([])
    const [total, setTotal] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState("")

    // Filters & Pagination
    const [search, setSearch] = useState("")
    const [status, setStatus] = useState("ALL")
    const [page, setPage] = useState(1)
    const pageSize = 10

    // Modals
    const [editingUser, setEditingUser] = useState<Nutritionist | null>(null)

    const fetchNutritionists = async () => {
        setIsLoading(true)
        setError("")
        try {
            const res = await nutritionistsService.list({ q: search, status, page, pageSize })
            setNutritionists(res.data)
            setTotal(res.total)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al cargar nutricionistas")
        } finally {
            setIsLoading(false)
        }
    }

    // Effect for checking authentication first
    useEffect(() => {
        const user = getUserFromToken()
        if (user) {
            setRole(user.role)
        }
        setIsRoleChecked(true)
    }, [])

    // Effect for fetching logic - triggers when filters or page changes
    useEffect(() => {
        if (role !== "ADMIN") return

        if (isMock) {
            setNutritionists(MOCK_NUTRITIONISTS)
            setTotal(MOCK_NUTRITIONISTS.length)
            setIsLoading(false)
            return
        }

        const timeoutId = setTimeout(() => {
            fetchNutritionists()
        }, 300)
        return () => clearTimeout(timeoutId)
    }, [search, status, page, role, isMock])

    // EARLY RETURN: Not authorized
    if (role !== "ADMIN") {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto">
                <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
                    <ShieldAlert className="h-8 w-8" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h1>
                <p className="text-gray-500 mb-8">No tienes los permisos necesarios para visualizar el módulo de administración.</p>
                <Button onClick={() => router.push("/dashboard")} className="w-full">
                    Volver al inicio
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Nutricionistas</h1>
                    <p className="text-sm text-gray-500 mt-1">Administra cuentas de nutricionistas del sistema.</p>
                </div>
            </div>

            {/* Content Area */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl border border-gray-200 shadow-sm">
                <NutritionistsFilters
                    search={search}
                    status={status}
                    onSearchChange={(val) => { setSearch(val); setPage(1); }}
                    onStatusChange={(val) => { setStatus(val); setPage(1); }}
                    onClear={() => {
                        setSearch("");
                        setStatus("ALL");
                        setPage(1);
                    }}
                />

                {error ? (
                    <div className="py-12 flex flex-col items-center text-center">
                        <p className="text-red-500 mb-4">{error}</p>
                        <Button variant="outline" onClick={fetchNutritionists}>Reintentar</Button>
                    </div>
                ) : isLoading && nutritionists.length === 0 ? (
                    <div className="py-24 flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        <NutritionistsTable
                            data={nutritionists}
                            onEdit={(n) => setEditingUser(n)}
                        />

                        {/* Pagination simple footer info */}
                        {nutritionists.length > 0 && (
                            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
                                <span>Mostrando {nutritionists.length} de {total} resultados</span>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === 1}
                                        onClick={() => setPage(p => p - 1)}
                                    >Anterior</Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page * pageSize >= total}
                                        onClick={() => setPage(p => p + 1)}
                                    >Siguiente</Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Global Modals */}
            <NutritionistEditDrawer
                isOpen={!!editingUser}
                nutritionist={editingUser}
                onClose={() => setEditingUser(null)}
                onSuccess={() => {
                    fetchNutritionists()
                    setEditingUser(null)
                }}
            />
        </div>
    )
}
