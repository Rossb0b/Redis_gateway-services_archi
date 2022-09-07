export const config = {
  redis: {
    port: process.env.REDIS_PORT || 6379
  },
  channel: {
    gateway: "gateway"
  },
  event: {
    gateway: {
      /* Send by a service to communicate his new existence to the gateway */
      register: "register",
      /* Send by the gateway to communicate a unique identifier to the service */
      approvement: "approvement"
    }
  }
}
