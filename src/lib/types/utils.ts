type SnakeCase<S extends string> = S extends `${infer Head}${infer Tail}`
  ? Tail extends Uncapitalize<Tail>
    ? `${Lowercase<Head>}${SnakeCase<Tail>}`
    : `${Lowercase<Head>}_${SnakeCase<Tail>}`
  : S;

export type Snakify<T> = T extends Date
  ? T
  : T extends Array<infer U>
    ? Snakify<U>[]
    : T extends object
      ? {
          [K in keyof T as K extends string ? SnakeCase<K> : K]: Snakify<T[K]>;
        }
      : T;

type CamelCase<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Lowercase<Head>}${Capitalize<CamelCase<Tail>>}`
  : Lowercase<S>;

export type Camelify<T> = T extends Date
  ? T
  : T extends Array<infer U>
    ? Camelify<U>[]
    : T extends object
      ? {
          [K in keyof T as K extends string ? CamelCase<K> : K]: Camelify<T[K]>;
        }
      : T;
