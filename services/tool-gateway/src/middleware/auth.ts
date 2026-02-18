import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      botId: string;
      executionId: string;
    };
    user: {
      botId: string;
      executionId: string;
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async function (fastify: FastifyInstance) {
  const secret = process.env['BOT_JWT_SECRET'];
  if (!secret) {
    throw new Error(
      '[auth] BOT_JWT_SECRET environment variable is not set. ' +
        'This is a security boundary — refusing to start without it.',
    );
  }

  await fastify.register(fastifyJwt, { secret });

  fastify.decorate(
    'authenticate',
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        return reply.status(401).send({ success: false, error: 'Unauthorized' });
      }
    },
  );
});
