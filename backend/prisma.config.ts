import "./src/config/load-env";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: databaseUrl
    ? {
        url: databaseUrl
      }
    : undefined
});
