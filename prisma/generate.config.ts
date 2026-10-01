// Apenas geração/validação local: não carrega .env nem configura conexão.
import { defineConfig } from "prisma/config";

export default defineConfig({ schema: "./schema.prisma" });
