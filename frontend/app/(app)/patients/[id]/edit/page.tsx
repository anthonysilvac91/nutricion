"use client"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { api } from "@/lib/api"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Select } from "@/components/ui/Select"
import { Textarea } from "@/components/ui/Textarea"
import { Card, CardContent } from "@/components/ui/Card"
import { PageHeader } from "@/components/PageHeader"

const schema = z.object({
    name: z.string().min(2, "El nombre es requerido"),
    birthDate: z.string().min(1, "Fecha de nacimiento requerida"),
    gender: z.enum(["male", "female"]),
    email: z.string().email().optional().or(z.literal("")),
    observations: z.string().optional(),
})

export default function EditPatientPage() {
    const router = useRouter()
    const params = useParams()
    const id = params.id as string
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)

    const { register, handleSubmit, formState: { errors }, reset } = useForm({
        resolver: zodResolver(schema)
    })

    useEffect(() => {
        async function load() {
            try {
                const p = await api.getPatient(id)
                reset(p)
            } catch (e) {
                console.error(e)
                router.push("/patients")
            } finally {
                setFetching(false)
            }
        }
        if (id) load()
    }, [id, reset, router])

    const onSubmit = async (data: any) => {
        setLoading(true)
        try {
            await api.updatePatient(id, data)
            router.push(`/patients/${id}`)
        } catch (error) {
            console.error(error)
            alert("Error al actualizar paciente")
        } finally {
            setLoading(false)
        }
    }

    if (fetching) return <div>Cargando...</div>

    return (
        <div className="max-w-2xl mx-auto">
            <PageHeader title="Editar Paciente" subtitle="Modifica los datos del paciente" />

            <Card className="border-none shadow-md">
                <CardContent className="p-6">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nombre Completo *</Label>
                            <Input id="name" {...register("name")} placeholder="Ej: Juan Pérez" />
                            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message as string}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="birthDate">Fecha de Nacimiento *</Label>
                                <Input id="birthDate" type="date" {...register("birthDate")} />
                                {errors.birthDate && <p className="text-red-500 text-xs mt-1">{errors.birthDate.message as string}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gender">Sexo *</Label>
                                <Select id="gender" {...register("gender")}>
                                    <option value="male">Masculino</option>
                                    <option value="female">Femenino</option>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" {...register("email")} placeholder="ejemplo@correo.com" />
                            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message as string}</p>}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="observations">Observaciones</Label>
                            <Textarea id="observations" {...register("observations")} />
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button type="button" variant="ghost" onClick={() => router.back()}>Cancelar</Button>
                            <Button type="submit" disabled={loading} className="px-8 shadow-md shadow-primary/20">
                                {loading ? "Guardando..." : "Guardar Cambios"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
