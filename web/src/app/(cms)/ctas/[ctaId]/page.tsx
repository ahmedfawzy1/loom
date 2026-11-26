import { CtaForm } from "@loom-web/src/components/cta/CtaForm";

export default async function EditCtaPage({
  params,
}: {
  params: Promise<{ ctaId: string }>;
}) {
  const { ctaId } = await params;
  return <CtaForm ctaId={ctaId} />;
}
