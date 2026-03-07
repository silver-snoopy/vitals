import type { FastifyRequest, FastifyReply } from 'fastify';

export function apiKeyMiddleware(apiKey: string) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    if (!apiKey) return; // no key configured → open (dev mode)

    const provided = request.headers['x-api-key'];
    if (provided !== apiKey) {
      return reply.code(401).send({ error: 'Unauthorized', message: 'Invalid or missing X-API-Key header', statusCode: 401 });
    }
  };
}
