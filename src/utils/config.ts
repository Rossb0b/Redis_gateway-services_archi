export const config = {
  redis: {
    port: process.env.REDIS_PORT || 6379
  }
}

export const serviceStoreName = "service";

export const channels = {
  gateway: "gateway"
};

export const events = {
  gatewayChannels: {
    /* Events relative to the registration of a new service */
    registration: {
      /* Send by a service to communicate his new existence to the gateway */
      register: "register",
      /* Send by the gateway to communicate a unique identifier to the service */
      approvement: "approvement",
    }
  },
  serviceChannels: {
    check: {
      /* Send by the gateway to check if a service is still alive */
      ping: "ping",
      /* Send back by the service as a response to a ping */
      pong: "pong"
    }
  }
};
