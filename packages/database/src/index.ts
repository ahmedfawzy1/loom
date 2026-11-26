// Types and enums only. The client singleton lives at @loom/database/client so that
// importing a model type never constructs a PrismaClient — a bare `new PrismaClient()` here loads
// the query engine in every consumer, including the bundled admin frontend.
export * from "../generated/client";
export * from "./languages";
