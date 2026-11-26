import { CtaList } from "@loom-web/src/components/cta/CtaList";
import { parseStatusParam } from "@loom-web/src/lib/content/status-param";

export default async function CtaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <CtaList initialStatus={parseStatusParam(status)} />;
}
