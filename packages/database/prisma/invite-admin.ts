// Makes someone an Admin and prints a one-time link for them to choose a password. Every other
// account is added by an Admin in Users, so this is how a new install gets its first one, and how
// an Admin who is locked out — disabled, or with a forgotten password — gets back in.
//
//   pnpm admin:invite you@company.com [--name "Your Name"] [--url https://cms.example.com]
//
// --url is where the admin app is served, for the link (default CMS_ADMIN_URL, then
// http://localhost:3000). It needs CMS_DATABASE_URL and nothing else, so run it wherever
// `pnpm db:migrate` runs.
import { parseArgs } from "node:util";
import {
  AuditAction,
  CmsRole,
  CmsUserStatus,
  type Prisma,
  PrismaClient,
} from "../generated/client";
import { newPasswordLink, normalizeEmail } from "../src/credentials";

const USAGE =
  'Usage: pnpm admin:invite <email> [--name "Full name"] [--url https://cms.example.com]';

// Who the Activity log says made the change, since nobody is signed in
const ACTOR = "Command line";

const prisma = new PrismaClient();

function readArgs() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      name: { type: "string" },
      url: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  if (values.help) return undefined;

  const [email] = positionals;
  if (!email || positionals.length > 1 || !email.includes("@"))
    throw new Error(USAGE);

  const url =
    values.url ?? process.env.CMS_ADMIN_URL ?? "http://localhost:3000";
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    throw new Error(
      `--url must be the admin app's address, such as https://cms.example.com — got "${url}"`,
    );
  }

  return { email: normalizeEmail(email), name: values.name?.trim(), origin };
}

async function main() {
  const args = readArgs();
  if (!args) {
    console.log(USAGE);
    return;
  }

  const existing = await prisma.cmsUser.findUnique({
    where: { email: args.email },
    include: { password: { select: { userId: true } } },
  });
  const link = newPasswordLink();

  await prisma.$transaction(async (tx) => {
    const audit = (
      action: AuditAction,
      userId: string,
      metadata: Prisma.InputJsonObject,
    ) =>
      tx.auditLog.create({
        data: {
          userEmail: ACTOR,
          action,
          contentId: userId,
          metadata: { email: args.email, ...metadata },
        },
      });

    const user = existing
      ? await tx.cmsUser.update({
          where: { id: existing.id },
          data: {
            role: CmsRole.ADMIN,
            // A disabled account comes back too: this is the way in when nobody else can let you in
            ...(existing.status === CmsUserStatus.DISABLED && {
              status: existing.password
                ? CmsUserStatus.ACTIVE
                : CmsUserStatus.PENDING,
            }),
            ...(args.name && { name: args.name }),
          },
        })
      : await tx.cmsUser.create({
          data: {
            email: args.email,
            name: args.name || null,
            role: CmsRole.ADMIN,
          },
        });

    await tx.cmsPasswordLink.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        tokenHash: link.tokenHash,
        expiresAt: link.expiresAt,
      },
      update: {
        tokenHash: link.tokenHash,
        expiresAt: link.expiresAt,
        createdAt: new Date(),
      },
    });

    if (!existing) {
      await audit(AuditAction.USER_INVITED, user.id, { role: CmsRole.ADMIN });
      return;
    }
    if (existing.role !== CmsRole.ADMIN)
      await audit(AuditAction.USER_ROLE_CHANGED, user.id, {
        from: existing.role,
        to: CmsRole.ADMIN,
      });
    if (existing.status === CmsUserStatus.DISABLED)
      await audit(AuditAction.USER_REACTIVATED, user.id, {});
    await audit(
      existing.password
        ? AuditAction.USER_PASSWORD_RESET
        : AuditAction.USER_INVITED,
      user.id,
      {},
    );
  });

  const url = `${args.origin}/set-password#token=${link.token}`;
  console.log(
    [
      `${args.email} is an Admin.`,
      "",
      "Open this link to choose a password. It works once, until",
      `${link.expiresAt.toUTCString()}:`,
      "",
      `  ${url}`,
      "",
      existing?.password
        ? "Their current password keeps working until a new one is chosen."
        : "Anyone with the link can set the password, so send it only to them.",
    ].join("\n"),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
