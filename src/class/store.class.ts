// Import Third-party Dependencies
import * as Redis from "@myunisoft/redis-utils";
import { PublishData } from "./microservice.class";

// CONSTANTS
const kPrefix = "service";

export interface Metric {
  lastActivity: number;
  aliveSince: number;
}

export interface StoreOptions {
  prefix?: string;
}

type CustomStore = PublishData & Metric;

export class Store {
  public KvPeer: Redis.KVPeer<CustomStore>

  constructor(options: StoreOptions = {}) {
    this.KvPeer = new Redis.KVPeer({
      prefix: `${options.prefix ? `${options.prefix}-` : ""}${kPrefix}`,
      type: "object"
    });
  }
}
