import { OsClient } from "@/components/OsClient";

export default async function ModulePage({
  params
}: {
  params: Promise<{ moduleKey: string }>;
}) {
  const { moduleKey } = await params;
  return <OsClient initialModule={moduleKey} />;
}
