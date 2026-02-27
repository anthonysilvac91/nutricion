"use client"

import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Button } from "@/components/ui/Button"
import { Search, X } from "lucide-react"

interface NutritionistsFiltersProps {
    search: string
    status: string
    onSearchChange: (val: string) => void
    onStatusChange: (val: string) => void
    onClear: () => void
}

export function NutritionistsFilters({ search, status, onSearchChange, onStatusChange, onClear }: NutritionistsFiltersProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    placeholder="Buscar por nombre o email..."
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="pl-9 h-10 w-full"
                />
            </div>

            <Select
                value={status}
                onChange={(e) => onStatusChange(e.target.value)}
                className="w-full sm:w-[200px] h-10"
            >
                <option value="ALL">Todos los estados</option>
                <option value="ACTIVE">Activos</option>
                <option value="SUSPENDED">Suspendidos</option>
            </Select>

            {(search || status !== "ALL") && (
                <Button
                    variant="ghost"
                    onClick={onClear}
                    className="h-10 px-4 text-gray-500 hover:text-gray-900"
                >
                    <X className="h-4 w-4 mr-2" />
                    Limpiar
                </Button>
            )}
        </div>
    )
}
