/**
 * @kyb/shared — the cross-tier contract: response envelope, error codes, and the
 * environment schema. Both the server and (where relevant) the web client import
 * from here so the wire format and config contract cannot drift.
 */

export * from './http'
export * from './env'
export * from './auth'
export * from './clients'
export * from './assessments'
