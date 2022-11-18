const Gateway = require("../dist/class/gateway.class");
const Redis = require("@myunisoft/redis-utils");

const kPrefix = "local";

async function initGateway() {
  await Redis.initRedis({ port: process.env.REDIS_PORT || 6379 });

  const gateway = new Gateway.Gateway({ prefix: kPrefix });
  await gateway.clearTree("local-service");
  await gateway.initialize();
}

initGateway().catch(error => console.error(error));
