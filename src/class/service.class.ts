// Import Node.js Dependencies
import { EventEmitter } from "events";

// Import Third-party Dependencies
import * as Redis from "@myunisoft/redis-utils";
import { EventOptions, Events } from "@myunisoft/events";
import { v4 as uuidv4 } from "uuid";
import * as logger from "pino";

// Import Internal Dependencies
import { channels, config, events } from "../utils/config";
import {
  TransactionMetadata,
  Prefix,
  RegistrationDataIn,
  RegistrationMetadataIn,
  SubscribeTo,
  PongMessage
} from "../types/index";

type ServiceOptions = RegistrationDataIn;

export class Service<T extends keyof Events = keyof Events> extends EventEmitter {
  readonly gatewayChannel: Redis.Channel<
    { event: string; data: RegistrationDataIn },
    RegistrationMetadataIn
  >;
  readonly gatewayChannelName: string;
  readonly prefix: Prefix | undefined;
  readonly subscribeTo: SubscribeTo[] | undefined;

  readonly personalUuid: string = uuidv4();
  protected subscriber: Redis.Redis;

  private name: string;
  private logger: logger.Logger;
  private givenUuid: string;
  private serviceChannelName: string;
  private serviceChannel: Redis.Channel<
    PongMessage | EventOptions<T>,
    TransactionMetadata
  >;

  constructor(options: ServiceOptions) {
    super();

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
  }

  get redis() {
    return Redis.getRedis();
  }

  public async publish(options: EventOptions<T>) {
    await this.serviceChannel.publish(Object.assign({}, options, {
      metadata: {
        origin: this.givenUuid,
      }
    }));

    this.logger.info({
      event: options.name
    },"Published a new event to the gateway");
  }

  public async initialize() {
    const { port } = config.redis;

    // Subscribe to the gateway channel
    this.subscriber = await Redis.initRedis({ port } as any, true);
    await this.subscriber.subscribe(this.gatewayChannelName);

    this.subscriber.on("message", async(channel, message) => {
      const formatedMessage = { ...JSON.parse(message) };

      // Avoid reacting to his own message
      if (formatedMessage.metadata &&
        (
          formatedMessage.metadata.origin === this.personalUuid ||
          formatedMessage.metadata.origin === this.givenUuid
        )
      ) {
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
    });

    await this.gatewayChannel.publish({
      event: events.gatewayChannels.registration.register,
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

    await new Promise((resolve) => this.once("registred", () => {
      console.log("FIFOHIUDHIKUFDHFJKHSJDKFHJDSKJF");
      resolve(null);
    }));
  }

  private async registerPrivateChannel(data: Record<string, any>) {
    this.serviceChannelName = `${this.prefix ? `${this.prefix}-` : ""}${data.uuid}`;

    await this.subscriber.subscribe(this.serviceChannelName);

    this.serviceChannel = new Redis.Channel({
      name: data.uuid,
      prefix: this.prefix
    });

    this.givenUuid = data.uuid;

    this.emit("registred");
  }

  private async handleGatewayMessages(message: Record<string, any>): Promise<void> {
    const { event, data, metadata } = message;

    switch (event) {
      case events.gatewayChannels.registration.approvement:
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
    const { event } = message;

    if (channel === this.serviceChannelName) {
      if (event === events.serviceChannels.check.ping) {
        const { metadata } = message as { data: Record<string, any>, metadata: TransactionMetadata };

        const event = {
          event: events.serviceChannels.check.pong,
          data: {
            prefix: this.prefix
          },
          metadata: {
            origin: this.givenUuid,
            to: metadata.origin,
            transactionId: metadata.transactionId
          }
        }

        await this.serviceChannel.publish(event);

        this.logger.info({
          event,
          metadata,
          uptime: process.uptime()
        }, "PUBLISHED PONG");
      }
      else {
        const { data, metadata } = message;

        console.log("not happening", channel, event, data, metadata);
      }
    }
  }
}


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
