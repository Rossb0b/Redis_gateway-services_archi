// Import Third-party Dependencies
import * as Redis from "@myunisoft/redis-utils";
import { v4 as uuidv4 } from "uuid";
import * as logger from "pino";

// Import Internal Dependencies
import { channels, config, events } from "../utils/config";
import {
  Prefix,
  RegistrationDataIn,
  RegistrationMetadataIn,
  SubscribeTo
} from "../types/index";

type MicroServiceOptions = RegistrationDataIn;

export class MicroService {
  readonly gatewayChannel: Redis.Channel<MicroServiceOptions, RegistrationMetadataIn>;
  readonly gatewayChannelName: string;
  readonly prefix: Prefix | undefined;
  readonly subscribeTo: SubscribeTo | undefined;

  readonly personalUuid: string = uuidv4();
  protected subscriber: Redis.Redis;

  private name: string;
  private logger: logger.Logger;
  private serviceChannelName: string;
  private serviceChannel: Redis.Channel;

  constructor(options: MicroServiceOptions) {
    const { name, prefix, subscribeTo } = options;

    this.name = name;
    this.prefix = prefix;
    this.subscribeTo = subscribeTo;
    this.gatewayChannelName = `${prefix ? `${prefix}-` : ""}${channels.gateway}`;

    // Gérer ENV ??
    this.logger = logger.pino().child({ service: `${prefix ? `${prefix}-` : ""}${this.name}` });

    this.gatewayChannel = new Redis.Channel({
      name: channels.gateway,
      prefix
    });

    console.log("personnal uuid :", this.personalUuid);
  }

  get redis() {
    return Redis.getRedis();
  }

  public async initialize() {
    const { port } = config.redis;

    // Subscribe to the gateway channel
    this.subscriber = await Redis.initRedis({ port } as any, true);
    await this.subscriber.subscribe(this.gatewayChannelName);

    let index = 0;
    this.subscriber.on("message", async(channel, message) => {
      const formatedMessage = { ...JSON.parse(message) };

      // Avoid reacting to his own message
      if (formatedMessage.metadata && formatedMessage.metadata.origin === this.personalUuid) {
        return;
      }

      try {
        switch (channel) {
          case this.gatewayChannelName :
            if (formatedMessage.metadata.to === this.personalUuid) {
              await this.handleGatewayMessages(formatedMessage);
            }
            break;
          default:
            await this.handleMessages(channel, formatedMessage);
            break;
        }
      }
      catch (error) {
        console.error(error);
      }
      finally {
        index++;
      }
    });

    await this.gatewayChannel.publish({
      event: events.gateway.register,
      data: {
        name: this.name,
        prefix: this.prefix,
        subscribeTo: this.subscribeTo
      },
      metadata: {
        origin: this.personalUuid
      }
    });

    this.logger.info({ uptime: process.uptime() }, "Registring as a new service to the gateway");
  }

  private async registerPrivateChannel(data: Record<string, any>) {
    this.serviceChannelName = `${this.prefix ? `${this.prefix}-` : ""}${data.uuid}`;

    console.log("attributed uuid", data.uuid);

    await this.subscriber.subscribe(this.serviceChannelName);

    this.serviceChannel = new Redis.Channel({
      name: data.uuid,
      prefix: this.prefix
    });
  }

  private async handleGatewayMessages(message: Record<string, any>): Promise<void> {
    const { event, data, metadata } = message;

    switch (event) {
      case events.gateway.approvement:
        this.logger.info({
          event,
          data,
          metadata,
          uptime: process.uptime()
        }, "New approvement message from gateway.");

        await this.registerPrivateChannel(data);
        break;
      default:
        this.logger.info({
          event,
          data,
          metadata,
          uptime: process.uptime()
        }, "New unknown message from gateway");
        break;
    }
  }

  private async handleMessages(channel: string, message: Record<string, any>): Promise<void> {
    const { event, data, metadata } = message;

    console.log("not happening", channel, event, data, metadata);
    // if (channel === this.serviceChannelName) {
    // }
  }
}
