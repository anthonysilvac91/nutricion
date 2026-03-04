"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ShieldAlert, Plus, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/Button"
import { NutritionistsFilters } from "@/components/admin/nutritionists/NutritionistsFilters"
import { NutritionistsTable } from "@/components/admin/nutritionists/NutritionistsTable"
import { NutritionistFormModal } from "@/components/admin/nutritionists/NutritionistFormModal"
import { NutritionistEditDrawer } from "@/components/admin/nutritionists/NutritionistEditDrawer"

import { Nutritionist, nutritionistsService } from "@/services/nutritionistsService"
import { getUserFromToken } from "@/lib/auth"

export default function AdminNutritionistsPage() {
    const router = useRouter()
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
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<Nutritionist | null>(null)

    const fetchNutritionists = async () => {
        setIsLoading(true)
        setError("")
        try {
            const res = await nutritionistsService.list({ q: search, status, page, pageSize })
            setNutritionists(res.data)
            setTotal(res.total)
        } catch (err: any) {
            setError(err.message || "Error al cargar nutricionistas")
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
        if (role === "ADMIN") {
            const timeoutId = setTimeout(() => {
                fetchNutritionists()
            }, 300) // debounce
            return () => clearTimeout(timeoutId)
        }
    }, [search, status, page, role])

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
                <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Crear nutricionista
                </Button>
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
            <NutritionistFormModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onSuccess={fetchNutritionists}
            />

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
