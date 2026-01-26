import { Search } from "lucide-react"
import { Input, InputProps } from "@/components/ui/Input"
import { cn } from "@/lib/utils"

export const SearchInput = ({ className, ...props }: InputProps) => {
    return (
        <div className={cn("relative", className)}>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-10" {...props} />
        </div>
    )
}
