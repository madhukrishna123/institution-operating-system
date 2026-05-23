export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export type ApiSession = {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    linked_student_id?: number | null;
  };
  role: string;
  permissions: string[];
  institution: { id: number; name: string };
};

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

async function readError(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    return parsed.detail ?? text;
  } catch {
    return text;
  }
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  token?: string
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export async function apiPatch<T>(
  path: string,
  body: unknown,
  token?: string
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}

export async function apiDelete<T>(path: string, token?: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined
  });
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return response.json();
}
