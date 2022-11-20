const Services = require("../dist/class/service.class");
const Redis = require("@myunisoft/redis-utils");

const kPrefix = "local";

const subscribeTo = [
  {
    event: "foo"
  },
  {
    event: "bar",
    delay: 3600,
    horizontalScall: false
  }
];

async function initService() {
  await Redis.initRedis({ port: process.env.REDIS_PORT || 6379 });

  const service = new Services.Service({ name: "foo", prefix: kPrefix, subscribeTo });
  await service.initialize();

  await service.publish({
    name: "connector",
    operation: "CREATE",
    data: {
      id: "1",
      code: "Foo"
    }
  });
}

initService().catch(error => console.error(error));

// const servicesTree = {
//   "local-service": {
//     "foo": {
//       "1": {
//         uuid: 1,
//         name: "foo",
//         lastActivity: 1,
//         aliveSince: 0,
//         subscribeTo: subscribeTo
//       },
//       "2": {
//         uuid: 2,
//         name: "foo",
//         lastActivity: 1,
//         aliveSince: 0,
//         subscribeTo: subscribeTo
//       },
//     },
//     "bar": {
//       "1": {
//         name: "bar",
//         lastActivity: 1,
//         aliveSince: 0,
//         subscribeTo: subscribeTo
//       }
//     }
//   },
//   "dev-service": {
//     "bar": {
//       "1": {
//         name: "bar",
//         lastActivity: 1,
//         aliveSince: 0,
//         subscribeTo: subscribeTo
//       }
//     }
//   }
// }

// const eventsTree = {
//   "1": {
//     name: "foo"
//   }
// }
