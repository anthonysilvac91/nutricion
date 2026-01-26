import { LucideIcon } from "lucide-react"

interface EmptyStateProps {
    icon?: LucideIcon
    title: string
    description?: string
    action?: React.ReactNode
}

export const EmptyState = ({ icon: Icon, title, description, action }: EmptyStateProps) => {
    return (
        <div className="flex flex-col items-center justify-center p-8 text-center rounded-lg border border-dashed min-h-[300px] bg-gray-50/50">
            {Icon && <div className="bg-white p-4 rounded-full mb-4 shadow-sm border"><Icon className="h-8 w-8 text-muted-foreground opacity-50" /></div>}
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm mb-6">{description}</p>}
            {action}
        </div>
    )
}
