const API_URL = "http://localhost:4000";

const getHeaders = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

const handleResponse = async (res: Response) => {
    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: "Error desconocido" }));
        throw new Error(error.message || "Error en la petición");
    }
    return res.json();
};

export const api = {
    // AUTH
    login: async (email: string, password: string) => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await handleResponse(res);
        return { token: data.access_token }; // NestJS JWT strategy usually returns access_token
    },

    register: async (email: string, password: string) => {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await handleResponse(res);
        return { token: data.access_token };
    },

    getMe: async () => {
        const res = await fetch(`${API_URL}/auth/me`, {
            method: "GET",
            headers: getHeaders(),
        });
        return handleResponse(res);
    },

    // PATIENTS
    getPatients: async () => {
        const res = await fetch(`${API_URL}/patients`, {
            method: "GET",
            headers: getHeaders(),
        });
        const data = await handleResponse(res);
        // Map backend format to frontend format if necessary
        return data.map((p: any) => ({
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            email: "—", // Backend patient model doesn't have email yet, maybe add later?
            lastMeasurement: "—", // Needs logic to get last measurement date
            ...p
        }));
    },

    getPatient: async (id: string) => {
        const res = await fetch(`${API_URL}/patients/${id}`, {
            method: "GET",
            headers: getHeaders(),
        });
        const p = await handleResponse(res);
        return {
            id: p.id,
            name: `${p.firstName} ${p.lastName}`,
            email: "—",
            birthDate: p.birthDate.split("T")[0], // Format date
            gender: p.sex === "MALE" ? "male" : "female",
            observations: `Nivel de actividad: ${p.activityLevel}`,
            measurements: p.measurements || [],
            ...p
        };
    },

    createPatient: async (data: any) => {
        // Map frontend form data to backend DTO
        const payload = {
            firstName: data.name.split(" ")[0],
            lastName: data.name.split(" ").slice(1).join(" ") || ".",
            sex: data.gender === "male" ? "MALE" : "FEMALE",
            birthDate: new Date(data.birthDate).toISOString(),
            activityLevel: "MODERATE", // Default or add field in form
            // email is not in Patient model in backend yet
        };

        const res = await fetch(`${API_URL}/patients`, {
            method: "POST",
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(res);
    },

    updatePatient: async (id: string, data: any) => {
        const payload: any = {};
        if (data.name) {
            payload.firstName = data.name.split(" ")[0];
            payload.lastName = data.name.split(" ").slice(1).join(" ") || ".";
        }
        if (data.gender) payload.sex = data.gender === "male" ? "MALE" : "FEMALE";
        if (data.birthDate) payload.birthDate = new Date(data.birthDate).toISOString();

        const res = await fetch(`${API_URL}/patients/${id}`, {
            method: "PATCH",
            headers: getHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(res);
    },

    deletePatient: async (id: string) => {
        const res = await fetch(`${API_URL}/patients/${id}`, {
            method: "DELETE",
            headers: getHeaders(),
        });
        return handleResponse(res);
    },

    // MEASUREMENTS (Placeholder - pending backend endpoint confirmation)
    createMeasurement: async (patientId: string, data: any) => {
        // Currently no direct endpoint in PatientsController for adding measurement?
        // Needs to be checked or implemented in backend.
        // For now returning mock to avoid breaking app if used
        console.warn("createMeasurement not yet implemented in backend connection");
        return { id: "mock", ...data, imc: "0" };
    },
};
