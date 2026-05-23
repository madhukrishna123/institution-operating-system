import { OsClient } from "@/components/OsClient";

async function getSeedUsers() {
  try {
    const apiBase = process.env.SERVER_API_BASE_URL ?? "http://127.0.0.1:8000";
    const response = await fetch(`${apiBase}/api/auth/seed-users`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return [];
    }
    return response.json();
  } catch {
    return [];
  }
}

export default async function ModulePage({
  params
}: {
  params: Promise<{ moduleKey: string }>;
}) {
  const { moduleKey } = await params;
  const seedUsers = await getSeedUsers();
  return <OsClient initialModule={moduleKey} initialSeedUsers={seedUsers} />;
}
