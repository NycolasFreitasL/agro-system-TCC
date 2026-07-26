import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const usuarios = await prisma.usuarios.findMany();

  return Response.json(usuarios);
}