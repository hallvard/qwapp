declare const capabilityType: unique symbol;

export interface SingleCapability<T> {
  key: string;
  cardinality: 'single';
  readonly [capabilityType]?: T;
}

export interface MultiCapability<T> {
  key: string;
  cardinality: 'multi';
  readonly [capabilityType]?: T;
}

export type CapabilityDescriptor<T> = SingleCapability<T> | MultiCapability<T>;

export function defineSingleCapability<T>(key: string): SingleCapability<T> {
  return { key, cardinality: 'single' };
}

export function defineMultiCapability<T>(key: string): MultiCapability<T> {
  return { key, cardinality: 'multi' };
}
