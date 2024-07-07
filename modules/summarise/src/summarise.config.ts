import { RetryPolicyConfig, Throttling } from "@summarisation/kleislis";
import { ValidateFn } from "@itsmworkbench/cli";
import { ErrorsAnd, NameAnd } from "@laoban/utils";

export type SummariseConfig = {
  directories: SummariseDirectories
  ai: SummariseAi
  tika: SummariseTika
  nonfunctionals: SummariseNonfunctionals
  schema: SummariseSchema
  report: SumariseReport
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
  if ( typeof s !== type ) return [ `${name} is not a string` ]
  return []
}
function validateDirectory ( directories: SummariseDirectories ): string[] {
  if ( typeof directories !== 'object' ) return [ 'Directories is not an object' ]
  const errors: string[] = []
  errors.push ( ...validateNeeded ( directories.inputs, 'directories.inputs' ) )
  errors.push ( ...validateNeeded ( directories.tika, 'directories.tika' ) )
  errors.push ( ...validateNeeded ( directories.text, 'directories.text' ) )
  errors.push ( ...validateNeeded ( directories.summary, 'directories.summary' ) )
  return errors
}
function validateAi ( ai: SummariseAi ) {
  if ( typeof ai !== 'object' ) return [ 'ai is not an object' ]
  const errors: string[] = []
  errors.push ( ...validateNeeded ( ai.type, 'ai.type' ) )
  if ( errors.length === 0 && ai.type !== 'openai' ) return [ 'Invalid AI type. Currently only openai allowed' ]
  errors.push ( ...validateNeeded ( ai.url, 'ai.url' ) )
  errors.push ( ...validateNeeded ( ai.model, 'ai.model' ) )
  errors.push ( ...validateNeeded ( ai.token, 'ai.token' ) )
  return errors
}
function validateNonfunctionals ( nonfunctionals: SummariseNonfunctionals ) {
  if ( typeof nonfunctionals !== 'object' ) return [ 'Nonfunctionals is not an object' ]
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
function validateSchema ( schema: SummariseSchema ) {
  if ( typeof schema !== 'object' ) return [ 'Schema is not an object' ]
  const errors: string[] = []
  errors.push ( ...validateNeeded ( schema.type, 'schema.type' ) )
  if ( errors.length === 0 && schema.type !== 'inline' ) return [ 'Invalid schema type. Currently only inline allowed' ]
  if ( schema.value === undefined ) errors.push ( 'schema.value is not defined' )
  return errors
}
function validateTika ( tika: SummariseTika ) {
  if ( typeof tika !== 'object' ) return [ 'Tika is not an object' ]
  const errors: string[] = []
  errors.push ( ...validateNeeded ( tika.type, 'tika.type' ) )
  if ( errors.length === 0 && tika.type !== 'jar' ) return [ 'Invalid tika type. Currently only jar allowed' ]
  errors.push ( ...validateNeeded ( tika.jar, 'tika.jar' ) )
  return errors
}
function validateReport ( report: SumariseReport ) {
  if ( typeof report !== 'object' ) return [ 'Report is not an object' ]
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
  errors.push ( ...validateSchema ( s.schema ) )
  errors.push ( ...validateNeeded ( s.prompt, 'prompt' ) )
  errors.push ( ...validateReport ( s.report ) )
  if ( errors.length > 0 ) return errors
  return s
};

