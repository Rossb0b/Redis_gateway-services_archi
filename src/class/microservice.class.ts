// Import Third-party Dependencies
import * as Redis from "@myunisoft/redis-utils";
import { v4 as uuidv4 } from "uuid";
import * as logger from "pino";

// Import Internal Dependencies
import { config } from "../config";
import { RegisterResponse } from "./gateway.class";

export interface MicroServiceOptions {
  /* Service name */
  name: string;
  /* Prefix for the channel name, commonly used to distinguish environnements */
  prefix?: string;
}

export interface PublishData {
  name: string;
}

export interface PublishMetadata {
  origin: string;
}

export class MicroService {
  readonly registrationChannel: Redis.Channel<PublishMetadata, PublishData>;
  readonly prefix: string | undefined;
  readonly gatewayChannel: string;

  protected personalUuid: string;
  protected subscriber: Redis.Redis;

  private name: string;
  private logger: logger.Logger;
  private channel: Redis.Channel;

  constructor(options: MicroServiceOptions) {
    const { name, prefix } = options;

    this.name = name;
    this.prefix = prefix;
    this.gatewayChannel = `${prefix ? `${prefix}-` : ""}${config.channel.gateway}`;

    this.personalUuid = uuidv4();

    // Gérer ENV ??
    this.logger = logger.pino().child({ service: `${prefix ? `${prefix}-` : ""}${this.name}` });

    this.registrationChannel = new Redis.Channel({
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

    await this.handleRegistrationServiceChannel();

    await this.registerOnGateway();
  }

  private async registerOnGateway() {
    await this.registrationChannel.publish({
      event: config.event.gateway.register,
      data: {
        name: this.name
      },
      metadata: {
        origin: this.personalUuid
      }
    });

    this.logger.info("Registring as a new service to the gateway");
  }

  private async handleRegistrationServiceChannel() {
    await this.subscriber.subscribe(this.gatewayChannel);

    this.subscriber.on("message", (channel, message) => {
      const { event, data, metadata } = JSON.parse(message) as RegisterResponse;

      if (metadata && metadata.origin === this.personalUuid) {
        return;
      }

      if (metadata.to === this.personalUuid) {
        if (event === config.event.gateway.approvement) {

          this.channel = new Redis.Channel({
            name: data.uuid,
            prefix: this.prefix
          });

          /*
          * Use the service channel to listen on event related to the specific services
          * and to push related response to the gateway
          */
         // console.log(this);

         this.logger.info({ event, data, metadata }, "New incoming message from gateway.");
        }
      }
    });
  }
}
