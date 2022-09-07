// Import Third-party Dependencies
import * as Redis from "@myunisoft/redis-utils";
import { v4 as uuidv4 } from "uuid";
import * as logger from "pino";

// Import Internal Dependencies
import { config } from "../config";
import { Metric, Store } from "./store.class";
import { PublishData, PublishMetadata } from "./microservice.class";

export interface GatewayOptions {
  /* Prefix for the channel name, commonly used to distinguish environnements */
  prefix?: string;
}

interface RegisterMessage {
  event: string;
  data: PublishData;
  metadata: PublishMetadata;
}

interface RegisterData {
  uuid: string;
}

interface ResponseMetadata {
  origin: string;
  to: string;
}

export interface RegisterResponse {
  event: string;
  data: RegisterData;
  metadata: ResponseMetadata;
}

export class Gateway extends Store {
  readonly channel: Redis.Channel<ResponseMetadata, RegisterData>;
  readonly name: string;
  readonly prefix: string | undefined;
  readonly channelName: string;

  protected personalUuid: string;
  protected subscriber: Redis.Redis;

  private logger: logger.Logger;
  private serviceChannels = new Map<string, Redis.Channel>();

  constructor(options: GatewayOptions = {}) {
    super();

    const { prefix } = options;

    this.name = "gateway";
    this.prefix = prefix;
    this.channelName = `${prefix ? `${prefix}-` : ""}${config.channel.gateway}`;

    this.personalUuid = uuidv4();

    this.logger = logger.pino().child({ gateway: `${prefix ? `${prefix}-` : ""}${this.name}` });

    this.channel = new Redis.Channel({
      name: config.channel.gateway,
      prefix
    });
  }

  get redis() {
    return Redis.getRedis();
  }

  public async initialize() {
    const { port } = config.redis;

    await Redis.initRedis({ port } as any);
    this.subscriber = await Redis.initRedis({ port } as any, true);

    await this.subscriber.subscribe(this.channelName);

    this.subscriber.on("message", async(channel, message) => {
      const { event, data, metadata } = JSON.parse(message) as RegisterMessage;

      if (metadata && metadata.origin === this.personalUuid) {
        return;
      }

      if (event === config.event.gateway.register) {
        const uuid = uuidv4();

        const now = Date.now();

        const metrics: Metric = {
          lastActivity: now,
          aliveSince: now
        }

        await this.KvPeer.setValue(Object.assign({}, data, metrics), uuid);

        await this.channel.publish({
          event: config.event.gateway.approvement,
          data: {
            uuid
          },
          metadata: {
            origin: this.personalUuid,
            to: metadata.origin
          }
        });

        this.serviceChannels.set(uuid, new Redis.Channel({
          name: uuid,
          prefix: this.prefix
        }));

        await this.subscriber.subscribe(`${this.prefix ? `${this.prefix}-` : ""}${uuid}`);

        this.logger.info({
          channel,
          event,
          data,
          metadata,
          uuid
        }, "foo");
      }
    });
  }
}
