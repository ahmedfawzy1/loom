/**
 * What a DTO looks like after JSON has been over the wire. A response DTO declares `Date` because
 * that is what it holds on the server, but the browser receives an ISO string — without this the
 * type is a lie and every component touching a date needs its own `Date | string` escape hatch.
 *
 * Applied once at ApiResponse rather than per call site, because the reason the lie existed is that
 * someone had to remember and nobody did.
 *
 * Branch order is load-bearing: `Date` must come before the object branch, since `Date extends
 * object` is true and the mapped type would otherwise swallow it. `JsonValue` must also come first
 * — it is a recursive union (`body`, `faq`, `metadata`, `socialLinks`), and recursing a mapped type
 * into it risks the instantiation-depth limit for no gain, as nothing inside a JSON value is a Date.
 */
type Serialized<T> = T extends Date
  ? string
  : T extends import("@loom/dto/models").JsonValue
    ? T
    : T extends Array<infer U>
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

/** Every CMS API response is wrapped by the api's ResponseInterceptor. */
interface ApiResponse<T> {
  success: boolean;
  data: Serialized<T>;
}
