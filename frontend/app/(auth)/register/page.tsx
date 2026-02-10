"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Label } from "@/components/ui/Label"
import { Activity } from "lucide-react"

export default function RegisterPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(false)

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const email = (e.target as any).email.value
            const password = (e.target as any).password.value

            const { token } = await api.register(email, password)

            localStorage.setItem("token", token)
            router.push("/dashboard")
        } catch (err: any) {
            alert(err.message || "Error al registrarse")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50/50 p-4">
            {/* Background decoration */}
            <div className="absolute inset-0 -z-10 bg-white [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#63e87720_100%)]"></div>

            <Card className="w-full max-w-md shadow-xl border-none ring-1 ring-gray-900/5">
                <CardHeader className="text-center space-y-4 pb-6">
                    <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
                        <Activity className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-800">Crear cuenta</CardTitle>
                    <p className="text-sm text-muted-foreground">Únete a NutriApp profesional</p>
                </CardHeader>
                <CardContent className="pt-0 pb-8 px-8">
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" name="email" type="email" placeholder="nombre@ejemplo.com" required className="h-11" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input id="password" name="password" type="password" required className="h-11" minLength={6} />
                        </div>
                        <Button type="submit" className="w-full h-11 text-base font-semibold mt-4 shadow-lg shadow-primary/20" disabled={loading}>
                            {loading ? "Creando cuenta..." : "Registrarse"}
                        </Button>
                    </form>

                    <div className="mt-6 text-center text-sm">
                        <span className="text-muted-foreground">¿Ya tienes cuenta? </span>
                        <Link href="/login" className="text-primary font-semibold hover:underline">
                            Ingresa aquí
                        </Link>
                    </div>
                </CardContent>
            </Card>
            <div className="absolute bottom-4 text-center text-xs text-muted-foreground">
                © 2025 NutriApp Inc.
            </div>
        </div>
    )
}
