const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001";

export async function apiFetch<T = unknown>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return res.json();
}

export function getFileUrl(filename: string): string {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : "";
  return `${API_BASE}/api/files/${encodeURIComponent(filename)}?token=${token}`;
}

export { API_BASE };
