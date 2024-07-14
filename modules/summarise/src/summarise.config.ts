import { RetryPolicyConfig, Throttling } from "@itsmworkbench/kleislis";

import { ValidateFn } from "@itsmworkbench/cli";
import { ErrorsAnd, NameAnd } from "@laoban/utils";
import fs from "node:fs";

export async function abortIfDirectoryDoesNotExist ( dir: string, message: string ) {
  try {
    await fs.promises.access ( dir )
  } catch ( e ) {
    console.error ( message )
    process.exit ( 2 )
  }

}
export type SummariseConfig = {
  directories: SummariseDirectories
  ai: SummariseAi
  tika: SummariseTika
  nonfunctionals: SummariseNonfunctionals
  report: SumariseReport
  transform: SummariseTransform
}
type TransformationType =  'onePerFile'| 'onePerPage'
export type SummariseTransform = {
  type: TransformationType
  schema: SummariseSchema
  prompt: string
}
export type SumariseReport = {
  categories: string[]
  fields: NameAnd<SumariseReportField>
}
export type SummariseReportEnum = {
  type: 'enum'
  enum: string[]
}
export type SummariseReportNumber = {
  type: 'number'
}
export type SumariseReportField = SummariseReportEnum | SummariseReportNumber

export type SummariseTika = {
  type: 'jar'
  jar: string
}
export type SummariseDirectories = {
  inputs: string
  tika: string
  text: string
  summary: string
}

export type SummariseAi = {
  type: 'openai'
  url: string
  model: string
  token: string
}
export type SummariseNonfunctionals = {
  throttlingPerHour: number
  concurrent: number
  retry: RetryPolicyConfig
}
export function configToThrottling ( config: SummariseNonfunctionals ): Throttling {
  return {
    tokensPer100ms: config.throttlingPerHour / 360000,
    max: config.throttlingPerHour,
    current: config.throttlingPerHour
  }
}

export type SummariseSchema = {
  type: 'inline'
  value: any
}

function validateNeeded ( s: any, name: string, type: string = 'string' ): string[] {
  if ( !s ) return [ `${name} is not defined` ]
  if ( typeof s !== type ) return [ `${name} is not a ${type}` ]
  return []
}
export function validateDirectory ( directories: SummariseDirectories ): string[] {
  if ( !directories || typeof directories !== 'object' ) return [ 'Directories is not an object' ]
  const errors: string[] = []
  errors.push ( ...validateNeeded ( directories.inputs, 'directories.inputs' ) )
  errors.push ( ...validateNeeded ( directories.tika, 'directories.tika' ) )
  errors.push ( ...validateNeeded ( directories.text, 'directories.text' ) )
  errors.push ( ...validateNeeded ( directories.summary, 'directories.summary' ) )
  return errors
}
export function validateAi ( ai: SummariseAi ) {
  if ( !ai || typeof ai !== 'object' ) return [ 'ai is not an object' ]
  const errors: string[] = []
  errors.push ( ...validateNeeded ( ai.type, 'ai.type' ) )
  if ( errors.length === 0 && ai.type !== 'openai' ) return [ 'Invalid AI type. Currently only openai allowed' ]
  errors.push ( ...validateNeeded ( ai.url, 'ai.url' ) )
  errors.push ( ...validateNeeded ( ai.model, 'ai.model' ) )
  errors.push ( ...validateNeeded ( ai.token, 'ai.token' ) )
  return errors
}
export function validateNonfunctionals ( nonfunctionals: SummariseNonfunctionals ) {
  if ( !nonfunctionals || typeof nonfunctionals !== 'object' ) return [ 'Nonfunctionals is not an object' ]
  const errors: string[] = []
  errors.push ( ...validateNeeded ( nonfunctionals.throttlingPerHour, 'nonfunctionals.throttlingPerHour', 'number' ) )
  errors.push ( ...validateNeeded ( nonfunctionals.concurrent, 'nonfunctionals.concurrent', 'number' ) )
  errors.push ( ...validateRetry ( nonfunctionals.retry ) )
  return errors
}

function validateRetry ( retry: RetryPolicyConfig ) {
  if ( retry === undefined ) return [] //it's OK not to have one
  if ( typeof retry !== 'object' ) return [ 'retry is not an object' ]
  const errors: string[] = []
  errors.push ( ...validateNeeded ( retry.initialInterval, 'retry.initialInterval', 'number' ) )
  errors.push ( ...validateNeeded ( retry.maximumInterval, 'retry.maximumInterval', 'number' ) )
  errors.push ( ...validateNeeded ( retry.maximumAttempts, 'retry.maximumAttempts', 'number' ) )
  return errors
}
export function validateSchema ( schema: SummariseSchema, name: string ) {
  if ( !schema || typeof schema !== 'object' ) return [ `${name} is not an object` ]
  const errors: string[] = []
  errors.push ( ...validateNeeded ( schema.type, `${name}.type` ) )
  if ( errors.length === 0 && schema.type !== 'inline' ) return [ `${name}.type (${schema.type}) is invalid.Currently only inline allowed` ]
  if ( schema.value === undefined ) errors.push ( `${name}.value is not defined` )
  return errors
}
export function validateTika ( tika: SummariseTika ) {
  if ( !tika || typeof tika !== 'object' ) return [ 'Tika is not an object' ]
  const errors: string[] = []
  errors.push ( ...validateNeeded ( tika.type, 'tika.type' ) )
  if ( errors.length === 0 && tika.type !== 'jar' ) return [ 'Invalid tika type. Currently only jar allowed' ]
  errors.push ( ...validateNeeded ( tika.jar, 'tika.jar' ) )
  return errors
}
export function validateReport ( report: SumariseReport ) {
  if ( !report || typeof report !== 'object' ) return [ 'Report is not an object' ]
  const errors: string[] = []
  if ( report.fields === undefined ) return [ 'report.fields is not defined' ]
  if ( typeof report.fields !== 'object' ) return [ 'report.fields is not an object' ]
  if ( report.categories === undefined ) return [ 'report.categories is not defined' ]
  if ( !Array.isArray ( report.categories ) ) return [ 'report.categories is not an array' ]
  for ( const [ key, value ] of Object.entries ( report.fields ) ) {
    if ( typeof value !== 'object' ) return [ `report.fields.${key} is not an object` ]
    if ( value.type === undefined ) return [ `report.fields.${key}.type is not defined` ]
    if ( value.type !== 'enum' && value.type !== 'number' ) return [ `report.fields.${key}.type is not valid` ]
    if ( value.type === 'enum' && value.enum === undefined ) return [ `report.fields.${key}.enum is not defined` ]
    if ( value.type === 'enum' && !Array.isArray ( value.enum ) ) return [ `report.fields.${key}.enum is not an array` ]
  }
  return errors
}
export function validationTransform ( tx: SummariseTransform ): string[] {
  if ( !tx || typeof tx !== 'object' ) return [ 'transform is not an object' ]
  const errors: string[] = []
  if ( tx.type === undefined ) return [ 'transform.type is not defined' ]
  const legal = [ 'onePerFile', 'onePerPage' ]
  if ( !legal.includes ( tx.type ) ) return [ `transform.type (${tx.type}) is not valid. Valid values are ${legal.join ( ', ' )}` ]
  errors.push ( ...validateSchema ( tx.schema, 'transform.schema' ) )
  errors.push ( ...validateNeeded ( tx.prompt, 'transform.prompt' ) )
  return errors
}
export const validateConfig: ValidateFn<SummariseConfig, SummariseConfig> = ( s: SummariseConfig ): ErrorsAnd<SummariseConfig> => {
  const errors: string[] = []
  if ( typeof s !== 'object' ) {
    errors.push ( 'Config is not an object' )
    return errors
  }
  errors.push ( ...validateDirectory ( s.directories ) )
  errors.push ( ...validateAi ( s.ai ) )
  errors.push ( ...validateTika ( s.tika ) )
  errors.push ( ...validateNonfunctionals ( s.nonfunctionals ) )
  errors.push ( ...validateReport ( s.report ) )
  errors.push ( ...validationTransform ( s.transform ) )
  if ( errors.length > 0 ) return errors
  return s
};

