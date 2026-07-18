import Fastify from "fastify";
import cors from "@fastify/cors";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const fastify = Fastify({ logger: true });
const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db"
})
const prisma = new PrismaClient({ adapter });

interface TodoBody {
  description: string;
  done: boolean;
}
interface TodoParams {
  id: string;
}
function parseId(id: string): number | null {
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

// GET TODOS
fastify.get("/todos", async (_request, reply) => {
  try {
    return await prisma.todo.findMany();
  } catch (err) {
    fastify.log.error(err);
    reply.status(500);
    return { error: "Erro ao buscar todos" };
  }
});

// GET TODO by id
fastify.get<{ Params: TodoParams }>("/todos/:id", async (request, reply) => {
  const id = parseId(request.params.id);
  if (id === null) {
    reply.status(400);
    return { error: "Id inválido" };
  }

  const todo = await prisma.todo.findUnique({ where: { id } });
  if (!todo) {
    reply.status(404);
    return { error: "Todo not found" };
  }
  return todo;
});

// POST TODO
fastify.post<{ Body: TodoBody }>("/todos", async (request, reply) => {
  const { description } = request.body ?? {};

  if (!description || typeof description !== "string" || !description.trim()) {
    reply.status(400);
    return { error: "Description is required" };
  }

  try {
    const newTodo = await prisma.todo.create({
      data: {
        description: description.trim(),
        done: false,
      },
    });

    reply.status(201);
    return newTodo;
  } catch (err) {
    fastify.log.error(err);
    reply.status(500);
    return { error: "Erro ao criar todo" };
  }
});

// PUT TODO
fastify.put<{ Params: TodoParams; Body: TodoBody }>(
  "/todos/:id",
  async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      reply.status(400);
      return { error: "Id inválido" };
    }

    const { description, done } = request.body ?? {};

    if (description === undefined && done === undefined) {
      reply.status(400);
      return { error: "Envie ao menos um campo para atualizar" };
    }

    const data: TodoBody = {
        description: "",
        done: false
    };
    if (description !== undefined) data.description = description.trim();
    if (done !== undefined) data.done = done;

    try {
      const updatedTodo = await prisma.todo.update({
        where: { id },
        data,
      });

      return updatedTodo;
    } catch {
      reply.status(404);
      return { error: "Todo not found" };
    }
  }
);

// DELETE TODO
fastify.delete<{ Params: TodoParams }>(
  "/todos/:id",
  async (request, reply) => {
    const id = parseId(request.params.id);
    if (id === null) {
      reply.status(400);
      return { error: "Id inválido" };
    }

    try {
      await prisma.todo.delete({ where: { id } });
      reply.status(204);
      return;
    } catch {
      reply.status(404);
      return { error: "Todo not found" };
    }
  }
);

const start = async () => {
  try {
    await fastify.register(cors, {
      origin: "*",
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
    });

    await fastify.listen({ port: 3333, host: "0.0.0.0" });
    console.log("🚀 Server running at http://localhost:3333");
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

const shutdown = async () => {
  await prisma.$disconnect();
  await fastify.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
start();
