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
  gateway: {
    /* Send by a service to communicate his new existence to the gateway */
    register: "register",
    /* Send by the gateway to communicate a unique identifier to the service */
    approvement: "approvement",
    /* Send to check if a service is still alive */
    check: "check"
  }
};
