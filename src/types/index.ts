export interface SubscribeTo {
  eventName: string;
  delay?: number;
  horizontalScall?: boolean;
}

export type Prefix = "local" | "dev" | "preprod" | "prod";

export interface Interaction {
  event: string;
  data: Record<string, any> | null;
  metadata: {
    origin: string;
    to: string;
  }
  aliveSince: number;
}


// Messages

export interface RegistrationDataIn {
  /* Service name */
  name: string;
  /* Commonly used to distinguish environnements */
  prefix?: Prefix;
  subscribeTo?: SubscribeTo;
}

export interface RegistrationMetadataIn {
  origin: string;
}

export interface RegistrationMessageIn {
  event: string;
  data: RegistrationDataIn;
  metadata: RegistrationMetadataIn;
}

export interface RegistrationDataOut {
  uuid: string;
}

export interface RegistrationMetadataOut {
  origin: string;
  to: string;
}

export interface RegistrationMessageOut {
  event: string;
  data: RegistrationDataOut;
  metadata: RegistrationMetadataOut;
}
