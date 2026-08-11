import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: [
    "./src/schema/auth-schema.ts",
    "./src/schema/verification-email-schema.ts",
    "./src/schema/login-rate-limit-schema.ts",
  ],
  out: "./migrations",
});
