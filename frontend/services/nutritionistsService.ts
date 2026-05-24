import { API_BASE_URL } from "@/lib/api";

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "EXPIRED" | "BLOCKED";

export interface Nutritionist {
    id: string;
    email: string;
    subscriptionStatus: SubscriptionStatus;
    trialEndsAt: string | null;
    patientsCount: number;
    createdAt: string;
}

interface ApiNutritionist {
    id: string;
    email: string;
    createdAt: string;
    subscriptionStatus: SubscriptionStatus;
    trialEndsAt: string | null;
    _count?: {
        patients?: number;
    };
}

interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}

const getHeaders = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const handleResponse = async <T>(res: Response): Promise<T> => {
    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Error desconocido" }));
        throw new Error(error.message || "Error en la petición");
    }

    return res.json() as Promise<T>;
};

const mapNutritionist = (item: ApiNutritionist): Nutritionist => ({
    id: item.id,
    email: item.email,
    createdAt: item.createdAt,
    subscriptionStatus: item.subscriptionStatus,
    trialEndsAt: item.trialEndsAt,
    patientsCount: item._count?.patients ?? 0,
});

export const nutritionistsService = {
    async list(params: { q?: string; status?: string; page?: number; pageSize?: number }): Promise<{ data: Nutritionist[]; total: number }> {
        const searchParams = new URLSearchParams();
        searchParams.set("page", String(params.page || 1));
        searchParams.set("pageSize", String(params.pageSize || 10));

        if (params.q) {
            searchParams.set("search", params.q);
        }

        if (params.status && params.status !== "ALL") {
            searchParams.set("status", params.status);
        }

        const res = await fetch(`${API_BASE_URL}/admin/nutritionists?${searchParams.toString()}`, {
            method: "GET",
            headers: getHeaders(),
        });
        const payload = await handleResponse<PaginatedResponse<ApiNutritionist>>(res);

        return {
            data: payload.data.map(mapNutritionist),
            total: payload.meta.total,
        };
    },

    async update(id: string, payload: { subscriptionStatus?: SubscriptionStatus; extendTrialDays?: number }): Promise<Nutritionist> {
        const body: { setStatus?: SubscriptionStatus; extendTrialDays?: number } = {};

        if (payload.subscriptionStatus) {
            body.setStatus = payload.subscriptionStatus;
        }

        if (payload.extendTrialDays && payload.extendTrialDays > 0) {
            body.extendTrialDays = payload.extendTrialDays;
        }

        const res = await fetch(`${API_BASE_URL}/admin/nutritionists/${id}`, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify(body),
        });
        const updated = await handleResponse<ApiNutritionist>(res);

        return mapNutritionist(updated);
    },
};
