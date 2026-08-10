import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/schema/auth-schema.ts", "./src/schema/verification-email-schema.ts"],
  out: "./migrations",
});
