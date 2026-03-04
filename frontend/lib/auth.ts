export interface DecodedToken {
    sub: string;
    email: string;
    role: string;
    exp: number;
    iat: number;
}

export const getUserFromToken = (): DecodedToken | null => {
    if (typeof window === "undefined") return null;

    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
        const payloadBase64 = token.split(".")[1];
        if (!payloadBase64) return null;

        // Handle base64url to base64 conversion
        let base64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
        // Decode and parse payload
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split("")
                .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                .join("")
        );

        return JSON.parse(jsonPayload) as DecodedToken;
    } catch (e) {
        console.error("Error decoding token payload", e);
        return null;
    }
};

export const hasRole = (role: string): boolean => {
    const user = getUserFromToken();
    return user?.role === role;
};
