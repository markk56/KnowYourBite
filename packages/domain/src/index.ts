/**
 * @kyb/domain — pure, deterministic clinical & nutrition math.
 *
 * No I/O, no framework, no LLM. Everything here is unit-tested and is the single
 * source of every number the product trusts (ADR-000 §0.2). The AI layer may
 * only *propose* values that a dietitian reviews; the actual arithmetic lives
 * here.
 */

export * from './assert'
export * from './energy'
export * from './units'
export * from './scaling'
export * from './nutrition'
export * from './recipe'
export * from './validator'
export * from './macros'
export * from './macroPolicy'
export * from './allergens'
export * from './usdaNormalize'
