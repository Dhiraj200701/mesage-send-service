export async function apiKeyMiddleware(request, reply) {
  const apiKey = request.headers["x-api-key"];

  if (apiKey !== process.env.API_KEY) {
    return reply.code(401).send({
      success: false,
      message: "Unauthorized"
    });
  }
}
