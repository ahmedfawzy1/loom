import { PageHeader } from "@loom-web/src/components/ui/PageHeader";
import { Section } from "@loom-web/src/components/ui/Section";
import { ReviewQueue } from "@loom-web/src/components/workflow/ReviewQueue";

export default function ReviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        description="Every language waiting for a reviewer, oldest first. Open one to approve it or send it back."
        title="Review"
      />
      <Section bodyClassName="pt-1 pb-2">
        <ReviewQueue />
      </Section>
    </div>
  );
}
