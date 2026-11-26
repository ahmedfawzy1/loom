import type { AuditAction, AuditLog, Prisma } from "@loom/database";
import { Injectable } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/auth.types";
import { PrismaService } from "../prisma/prisma.service";

interface AuditEntry {
  action: AuditAction;
  contentType?: NonNullable<AuditLog["contentType"]>;
  contentId?: NonNullable<AuditLog["contentId"]>;
  languageCode?: NonNullable<AuditLog["languageCode"]>;
  spaceId?: NonNullable<AuditLog["spaceId"]>;
  metadata?: Prisma.InputJsonValue;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(user: AuthenticatedUser, entry: AuditEntry) {
    return this.prisma.auditLog.create({
      data: {
        userId: user.id,
        userEmail: user.email,
        ...entry,
        metadata: entry.metadata ?? {},
      },
    });
  }
}
