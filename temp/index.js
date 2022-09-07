const MicroServices = require("../dist/index");

const kPrefix = "local";

async function main() {
  const gateway = new MicroServices.Gateway({ prefix: kPrefix });
  await gateway.initialize();

  const service = new MicroServices.MicroService({ name: "foo", prefix: kPrefix });
  await service.initialize();

  const secondService = new MicroServices.MicroService({ name: "bar", prefix: kPrefix });
  await secondService.initialize();
}


main().catch(error => console.error(error));
