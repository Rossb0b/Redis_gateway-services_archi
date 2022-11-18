// Import Third-party Dependencies
import * as Redis from "@myunisoft/redis-utils";
import { v4 as uuidv4 } from "uuid";
import * as logger from "pino";

// Import Internal Dependencies
import { channels, config, events, serviceStoreName } from "../utils/config";
import { deepParse } from "../utils/utils";
import { Bar, Events, Foo } from "../events";
import {
  Interaction,
  Prefix,
  RegistrationDataIn,
  RegistrationDataOut,
  RegistrationMetadataIn,
  RegistrationMetadataOut,
  SubscribeTo,
  InteractionMetadata
} from "~/types";

// Constants
export const kServiceIdleTime = 7_200;
export const kCheckServices = 18_000;
export const kPingServiceInterval = 3_600;

interface ServiceStore {
  [key: string]: {
    uuid: string;
    lastActivity: number;
    aliveSince: number;
    subscribeTo?: SubscribeTo[];
  }
}

export interface GatewayOptions {
  /* Prefix for the channel name, commonly used to distinguish environnements */
  prefix?: Prefix;
  subscribeTo?: SubscribeTo[];
}

export class Gateway {
  readonly KvPeer: Redis.KVPeer;
  readonly name: string;
  readonly prefix: Prefix | undefined;
  readonly gatewayChannel: Redis.Channel<RegistrationDataOut, RegistrationMetadataOut>;
  readonly gatewayChannelName: string;

  protected personalUuid: string = uuidv4();
  protected subscriber: Redis.Redis;

  private logger: logger.Logger;
  private serviceChannels = new Map<string, Redis.Channel<Record<string, any>, InteractionMetadata>>();

  private treeNames = new Set<string>();

  private pingServiceInterval: NodeJS.Timer;
  private checkServiceInterval: NodeJS.Timer;

  private interactions = new Map<string, Interaction>();

  constructor(options: GatewayOptions = {}) {
    const { prefix } = options;

    this.KvPeer = new Redis.KVPeer({
      prefix,
      type: "raw"
    });

    this.name = "gateway";
    this.prefix = prefix;
    this.gatewayChannelName = `${prefix ? `${prefix}-` : ""}${channels.gateway}`;

    this.logger = logger.pino().child({ gateway: `${prefix ? `${prefix}-` : ""}${this.name}` });

    this.gatewayChannel = new Redis.Channel({
      name: channels.gateway,
      prefix
    });
  }

  public async initialize() {
    const { port } = config.redis;

    // Subscribe to the gateway channel
    this.subscriber = await Redis.initRedis({ port } as any, true);
    await this.subscriber.subscribe(this.gatewayChannelName);

    this.subscriber.on("message", async(channel, message) => {
      const formatedMessage = { ...JSON.parse(message) };

      // Avoid reacting to his own message
      if (formatedMessage.metadata && formatedMessage.metadata.origin === this.personalUuid) {
        return;
      }

      try {
        switch (channel) {
          case this.gatewayChannelName :
            await this.handleGatewayMessages(formatedMessage);
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

    this.pingServiceInterval = setInterval(async() => {
      try {
        await this.pingServices();
      }
      catch (error) {
        console.error(error);
      }
    }, kPingServiceInterval).unref();

    this.checkServiceInterval = setInterval(async() => {
      try {
        await this.checkServicesLastActivity();
      }
      catch (error) {
        console.error(error);
      }
    }, kCheckServices).unref();
  }

  public async clearTree(treeName: string) {
    await this.KvPeer.deleteValue(treeName);
  }

  public async getTree(treeName: string) {
    const tree = await this.KvPeer.getValue(treeName);

    return tree ? this.formateTree(JSON.parse(tree as string)) : null;
  }

  private async approveService(data: RegistrationDataIn, metadata: RegistrationMetadataIn) {
    const uuid = uuidv4();
    const now = Date.now();

    const service = Object.assign({}, {
      uuid,
      subscribeTo: JSON.stringify(data.subscribeTo),
      lastActivity: now,
      aliveSince: now,
      ...data
    });

    // Update the tree
    const treeName = `${data.prefix ? `${data.prefix}-` : ""}${serviceStoreName}`;
    let relatedTree = (await this.KvPeer.getValue(treeName)) ?? {};

    relatedTree = typeof relatedTree === "string" ? JSON.parse(relatedTree) : relatedTree;

    relatedTree[uuid] = service;

    await this.KvPeer.setValue({
      key: treeName,
      value: JSON.stringify(relatedTree)
    });

    this.treeNames.add(treeName);

    // Subscribe to the exclusive service channel
    this.serviceChannels.set(uuid, new Redis.Channel({
      name: uuid,
      prefix: this.prefix
    }));
    await this.subscriber.subscribe(`${this.prefix ? `${this.prefix}-` : ""}${uuid}`);


    // Approve the service & send him info so he can use the dedicated channel
    const event = {
      event: events.gatewayChannels.registration.approvement,
      data: {
        uuid: uuid
      },
      metadata: {
        origin: this.personalUuid,
        to: metadata.origin
      }
    };

    await this.gatewayChannel.publish(event);

    this.logger.info({
      event,
      uptime: process.uptime()
    }, "PUBLISHED APPROVEMENT");
  }

  private async pingServices() {
    for (const treeName of this.treeNames) {
      const tree = await this.getTree(treeName);

      if (tree) {
        for (const uuid of Object.keys(tree)) {
          const serviceChannel = this.serviceChannels.get(uuid);

          if (serviceChannel) {
            const interactionId = uuidv4();

            const event = {
              event: events.serviceChannels.check.ping,
              data: {},
              metadata: {
                origin: this.personalUuid,
                to: uuid,
                interactionId
              }
            };

            await serviceChannel.publish(event);

            this.interactions.set(interactionId, { ...event, aliveSince: Date.now() });

            this.logger.info({
              ...event
            }, "PUBLISHED PING")
          }
        }
      }
    }
  }

  private async checkServicesLastActivity() {
    for (const treeName of this.treeNames) {
      const tree = await this.getTree(treeName);

      if (tree) {
        const now = Date.now();

        for (const [uuid, service] of Object.entries(tree)) {
          if (now > service.lastActivity + kServiceIdleTime) {
            // Remove the service from the tree & update it.
            delete tree[uuid];

            await this.KvPeer.setValue({
              key: treeName,
              value: JSON.stringify(tree)
            });

            for (const [interactionId, interaction] of this.interactions) {
              if (interaction.metadata.to === uuid) {
                // Delete ping interaction since the service is off
                if (interaction.event === events.serviceChannels.check.ping) {
                  this.interactions.delete(interactionId);
                }

                // redistribute events & so interactions to according services

                // delete the previous interactions
              }
            }

            this.logger.info({
              uuid,
              service
            }, "Removed inactif service");
          }
         }
      }
    }
  }

  private async handleMessages(channel: string, message: Record<string, any>) {
    const { event, data, metadata } = message;

    switch (event) {
      case events.serviceChannels.check.pong:
        this.logger.info({
          channel,
          event,
          data,
          metadata,
          uptime: process.uptime()
        }, "PONG FROM A SERVICE");

        const { interactionId } = metadata;

        const interaction = this.interactions.get(interactionId);

        if (interaction) {
          this.interactions.delete(interactionId);
        }

        const treeName = `${data.prefix ? `${data.prefix}-` : ""}${serviceStoreName}`;
        const tree = await this.getTree(treeName);

        if (tree) {
          tree[metadata.origin].lastActivity = Date.now();

          await this.KvPeer.setValue({
            key: treeName,
            value: JSON.stringify(tree)
          });
        }

        break;
      default:
        // Deal with possible event to distribute them to the related services (using the subscribeTo)
        this.logger.info({
          channel,
          event,
          data,
          metadata,
          uptime: process.uptime()
        }, "any event");

        break;
    }
  }

  private async handleGatewayMessages(message: Record<string, any>) {
    const { event, data, metadata } = message;

    switch (event) {
      case events.gatewayChannels.registration.register:
        this.logger.info({
          event,
          data,
          metadata,
          uptime: process.uptime()
        }, "A new service want to be registred");

        await this.approveService(data as RegistrationDataIn, metadata as RegistrationMetadataIn);

        break;
      default:
        this.logger.error({
          event,
          data,
          metadata
        }, "Unknown event for the gateway channel");

        break;
    }
  }

  private formateTree(tree: ServiceStore & Record<string, any>): Record<string, any> {
    const finalTree = {};

    for (const [uuid, service] of Object.entries(tree)) {
      const key = uuid;

      const formatedService = {};
      for (const [key, value] of deepParse(service)) {
        formatedService[key] = value;
      }

      finalTree[key] = formatedService;
    }

    return finalTree;
  }
}
