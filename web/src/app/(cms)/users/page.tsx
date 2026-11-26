import { PageHeader } from "@loom-web/src/components/ui/PageHeader";
import { InviteUserButton } from "@loom-web/src/components/user/InviteUserButton";
import { UsersTable } from "@loom-web/src/components/user/UsersTable";

export default function UsersPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        actions={<InviteUserButton />}
        description="Add people with the role they need. Each gets a one-time link to choose a password; nobody can sign up on their own."
        title="Users"
      />
      <UsersTable />
    </div>
  );
}
