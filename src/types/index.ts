export interface SubscribeTo {
  event: string;
  delay?: number;
  horizontalScall?: boolean;
}

export type Prefix = "local" | "dev" | "preprod" | "prod";

export interface Transaction {
  event: string;
  data?: Record<string, any>;
  metadata: {
    origin: string;
    to?: string;
  }
  aliveSince: number;
}


// Messages

export interface RegistrationDataIn {
  /* Service name */
  name: string;
  /* Commonly used to distinguish environnements */
  prefix?: Prefix;
  subscribeTo?: SubscribeTo[];
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
  data: {
    uuid: string;
  }
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

export interface PingMessage {
  event: string;
}

export interface PongMessage {
  event: string;
  data: {
    prefix?: Prefix;
  }
}

export interface TransactionMetadata {
  origin: string;
  to?: string;
  transactionId?: string;
}
