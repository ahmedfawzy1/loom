import { Prisma } from "@loom/database";
import type { CallToolResult } from "@modelcontextprotocol/server";
import { BadRequestException, HttpException, Logger } from "@nestjs/common";
import { type ClassConstructor, plainToInstance } from "class-transformer";
import { type ValidationError, validate } from "class-validator";

const logger = new Logger("Mcp");

export const READ_ONLY = { readOnlyHint: true, openWorldHint: false };

// Saves never publish and never delete: every one is a new version that can be restored over
export const SAVE = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: false,
};

/**
 * Runs a tool and answers with its result as JSON, or with Loom's own message when it refuses. A
 * refusal is the model's to fix (a missing field, a taken slug), so it is a tool error rather than a
 * protocol error, which a client would show as a failure instead of handing back to the model.
 */
export async function toolResult(
  work: () => Promise<unknown>,
): Promise<CallToolResult> {
  try {
    return { content: [{ type: "text", text: JSON.stringify(await work()) }] };
  } catch (error) {
    return {
      content: [{ type: "text", text: errorMessage(error) }],
      isError: true,
    };
  }
}

/** What went wrong, in the words the admin app would show. Anything unexpected is logged, not echoed. */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpException) {
    const body = error.getResponse();
    const message =
      typeof body === "object" && body !== null && "message" in body
        ? (body as { message: unknown }).message
        : body;
    return Array.isArray(message) ? message.join("; ") : String(message);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError)
    switch (error.code) {
      case "P2002":
        return "That slug or name is already taken in this Space. If no item you can find uses it, a trashed one may: a trashed item keeps its slug until it is restored or deleted for good.";
      case "P2025":
        return "That record no longer exists";
      case "P2003":
        return "Something still references that record";
    }

  logger.error(error instanceof Error ? error.stack : String(error));
  return "Loom could not do that because of an unexpected error. It was logged on the server.";
}

/**
 * The same validation the admin API runs on a request body, so a save through MCP is held to exactly
 * the rules a save from the editor is. The tool schemas describe the fields; the DTOs decide.
 */
export async function validated<T extends object>(
  type: ClassConstructor<T>,
  plain: object,
): Promise<T> {
  const instance = plainToInstance(type, plain);
  const errors = await validate(instance, { whitelist: true });
  if (errors.length) throw new BadRequestException(messages(errors));
  return instance;
}

// Nested errors read the way ValidationPipe words them: "faq.0.question should not be empty"
function messages(errors: ValidationError[], parentPath?: string): string[] {
  return errors.flatMap((error) => {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own = Object.values(error.constraints ?? {}).map((message) =>
      parentPath ? `${parentPath}.${message}` : message,
    );
    return [...own, ...messages(error.children ?? [], path)];
  });
}

/** The fields a tool call actually sent: an absent field leaves what is saved alone. */
export const definedFields = <T extends object>(fields: T) =>
  Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as Partial<T>;
