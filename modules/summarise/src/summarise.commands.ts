import { ActionFn, CliTc, CommandDetails, ContextConfigAndCommander } from "@itsmworkbench/cli";
import { SummariseContext } from "./summarise.context";
import { calculateSHA256, changeExtension, ExecuteConfig, executeRecursivelyCmdChanges, getFilesRecursively, inputToOutputFileName, TransformDirectoryIfShaChangedConfig, transformFiles, transformFilesIfShaChanged } from "@summarisation/fileutils";
import * as fs from "node:fs";
import * as cheerio from "cheerio";
import { defaultOpenAiConfig, Message, openAiClient } from "@summarisation/openai";
import { configToThrottling, SummariseAi, SummariseConfig, SummariseDirectories, SummariseTika } from "./summarise.config";
import { simpleTemplate } from "@itsmworkbench/utils";
import { NameAnd } from "@laoban/utils";
import path from "node:path";
import { startThrottling, stopThrottling, Task, Throttling, withConcurrencyLimit, withRetry, withThrottle } from "@summarisation/kleislis";

async function abortIfDirectoryDoesNotExist ( dir: string, message: string ) {
  try {
    await fs.promises.access ( dir )
  } catch ( e ) {
    console.error ( message )
    process.exit ( 2 )
  }

}

function inputsAction<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): ActionFn<Commander> {
  return async ( _, opts ) => {
    if ( opts.debug ) console.log ( `tika `, opts )
    await abortIfDirectoryDoesNotExist ( tc.config.directories.inputs, `inputs directory ${tc.config.directories.inputs} does not exist` )
    const { inputs, tika } = tc.config.directories
    const { jar } = tc.config.tika


    if ( opts.clean ) await fs.promises.rm ( tika, { recursive: true } )

    const config: ExecuteConfig = {
      debug: opts.debug === true,
      dryRun: opts.dryRun === true
    }
    const inToOutName = inputToOutputFileName ( inputs, tika, { newFileNameFn: changeExtension ( '.json' ) } )

    console.log ( 'made tika files', await executeRecursivelyCmdChanges ( tc.context.currentDirectory, inputs, dir => {
      let outDir = inToOutName ( dir );
      return `java -jar ${jar} -i ${dir} -o ${outDir} --jsonRecursive`;
    }, config ) )
  };
}
export function addInputsCommand<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'inputs',
    description: `turn pdf files into text files using apache tika. ${tc.config.directories.inputs} ==> ${tc.config.directories.tika}`,
    options: {
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: inputsAction ( tc )
  }
}
function tikaAction<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): ActionFn<Commander> {
  return async ( _, opts ) => {
    if ( opts.debug ) console.log ( `html `, opts )
    await abortIfDirectoryDoesNotExist ( tc.config.directories.tika, `tika directory ${tc.config.directories.tika} does not exist` )
    const { tika, text } = tc.config.directories
    if ( opts.clean ) await fs.promises.rm ( text, { recursive: true } )

    const digest = calculateSHA256
    const config: TransformDirectoryIfShaChangedConfig = {
      digest,
      getShaFromOutput: async ( s: string ) => {
        try {
          return s.split ( '\n' )[ 0 ]//first line is the digest
        } catch ( e ) {
          return ''
        }
      },
      filter: ( file: string ) => file.endsWith ( '.json' ),
      newFileNameFn: changeExtension ( '.txt' ),
      debug: opts.debug === true,
      dryRun: opts.dryRun === true
    }
    console.log ( 'made html files', await transformFiles ( fn => JSON
        .parse ( fn ).map ( ( page: any ) => {
          let html = page[ "X-TIKA:content" ];
          let $ = cheerio.load ( html );
          return $ ( 'body' ).text ()
        } )
      , config ) ( tika, text ) )
  };
}
export function addTikaCommand<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'tika',
    description: `turn tika files to text files ${tc.config.directories.tika} ==> ${tc.config.directories.text}`,
    options: {
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: tikaAction ( tc )
  }
}

function textAction<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): ActionFn<Commander> {
  return async ( _, opts ) => {
    if ( opts.debug ) console.log ( `text `, opts )
    await abortIfDirectoryDoesNotExist ( tc.config.directories.text, `text directory ${tc.config.directories.text} does not exist` )
    const { text, summary } = tc.config.directories
    if ( opts.clean ) await fs.promises.rm ( summary, { recursive: true } )
    const digest = calculateSHA256
    const config: TransformDirectoryIfShaChangedConfig = {
      digest,
      getShaFromOutput: async ( s: string ) => {
        try {
          return JSON.parse ( s ).sha
        } catch ( e: any ) {
          return undefined
        }
      },
      filter: ( file: string ) => file.endsWith ( '.txt' ),
      newFileNameFn: changeExtension ( '.json' ),
      debug: opts.debug === true,
      dryRun: opts.dryRun === true
    }
    const { url, token, model } = tc.config.ai
    const tokenValue = tc.context.env[ token ]
    if ( !tokenValue ) throw new Error ( `Environment variable ${token} is required for open ai.` );

    const openai = openAiClient ( defaultOpenAiConfig ( url, tokenValue, model ) )


    let transformOne = async ( f: string, sha: string ) => {
      const content = simpleTemplate ( tc.config.prompt, { knowledgeArticle: f } )
      let prompt: Message[] = [ { role: 'system', content } ];
      if ( opts.dryRun || opts.debug ) console.log ( 'prompt', prompt )
      if ( opts.dryRun ) return undefined
      let choices = await openai ( prompt );
      let chosen = choices.map ( m => m.content ).join ( '\n' );
      const json = JSON.parse ( chosen )
      return JSON.stringify ( { sha, ...json }, null, 2 )
    };
    const retry = tc.config.nonfunctionals.retry
    const throttling: Throttling = configToThrottling ( tc.config.nonfunctionals )
    const queue: Task<any>[] = [];
    const withNfcs = withRetry ( retry, withThrottle ( throttling, withConcurrencyLimit ( tc.config.nonfunctionals.concurrent, queue, transformOne ) ) )
    startThrottling ( throttling )
    try {
      console.log ( 'made summary files', await transformFilesIfShaChanged ( transformOne, config ) ( text, summary ) )
    } finally {
      stopThrottling ( throttling )
    }
  };
}
export function addTextCommand<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'text',
    description: `turn text files to summary`,
    options: {
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: textAction ( tc )
  }
}

export function addSummaryCommand<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'summary',
    description: `Does everything: turns pdfs => html => text => summary`,
    options: {
      '--clean': { description: 'Delete the output file directories at the start' },
      '--debug': { description: 'Show debug information' },
      '--noReport': { description: `Don't make a report` },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: async ( c, opts ) => {
      await inputsAction ( tc ) ( c, opts )
      await tikaAction ( tc ) ( c, opts )
      await textAction ( tc ) ( c, opts )
      if ( !opts.noReport ) await reportAction ( tc ) ( c, opts )
    }
  }
}

function reportAction<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): ActionFn<Commander> {
  return async ( c, opts ) => {
    const fields = tc.config.report.fields
    const result: NameAnd<any> = {}
    for ( const category of tc.config.report.categories ) {
      result[ category ] = {}
      for ( const [ field, fieldConfig ] of Object.entries ( fields ) ) {
        if ( fieldConfig.type === 'number' ) result[ category ][ field ] = 0
        else if ( fieldConfig.type === 'enum' ) result[ category ][ field ] = Object.fromEntries ( fieldConfig.enum.map ( e => ([ e, 0 ]) ) )
      }
    }
    const errors: NameAnd<string[]> = {}
    for await ( const file of getFilesRecursively ( tc.config.directories.summary ) ) {
      try {
        const json = JSON.parse ( await fs.promises.readFile ( path.join ( tc.context.currentDirectory, file ), 'utf-8' ) )
        for ( const category of tc.config.report.categories )
          for ( const [ field, fieldConfig ] of Object.entries ( fields ) ) {
            let value = json[ category ]?.[ field ];
            if ( opts.debug ) console.log ( file, 'field', field, fieldConfig.type, value )
            if ( fieldConfig.type === 'enum' ) {
              let oldValue = result[ category ]?.[ field ]?.[ value ] || 0;
              result[ category ][ field ][ value ] = 1 + oldValue
            }
            if ( fieldConfig.type === 'number' ) {
              const num = value
              if ( typeof num !== 'number' ) errors[ file ] = [ ...errors[ file ] || [], `${field} is not a number` ]
              result[ field ] += value || 0
            }
          }
      } catch ( e: any ) {
        errors[ file ] = [ ...errors[ file ] || [], e.message ]
      }
    }
    console.log ( JSON.stringify ( { result, errors }, null, 2 ) )
  };
}
export function addReportCommand<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'report',
    description: `Scans the summaries and reports on their quality `,
    options: {
      '--debug': { description: 'Show debug information' }
    },
    action: reportAction ( tc )
  }
}


export function addValidateCommand<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'validate',
    description: `Validates the configuration file`,
    options: {},
    action: async () => {
      async function validateDirectories ( dirs: SummariseDirectories ) {
        async function directory ( name: keyof SummariseDirectories, words: string ) {
          try {
            await fs.promises.access ( dirs[ name ] )
            console.log ( `    ${name.padEnd ( 10 )} ${dirs[ name ].padEnd ( 30 )}  -- ok` )
          } catch ( e ) {
            console.log ( `    ${name.padEnd ( 10 )} ${dirs[ name ].padEnd ( 30 )}  -- ${words}` )
          }
        }
        console.log ( 'Directories' )
        await directory ( 'inputs', 'does not exist. This needs is where you put the data to be summarised, so nothing works without this' )
        await directory ( 'tika', 'does not exist. It should be created when you `summarise summary`' )
        await directory ( 'text', 'does not exist. It should be created when you `summarise summary`' )
        await directory ( 'summary', 'does not exist. It should be created when you `summarise summary`' )
      }
      async function validateOpenAiConnectivity ( env: NameAnd<string>, ai: SummariseAi ) {
        console.log ( 'ai' )
        let problem = !env[ ai.token ];
        if ( problem ) console.log ( `    ${ai.token} is not set in the environment` )
        else console.log ( `    ${ai.token} is set in the environment` )
        try {
          await openAiClient ( defaultOpenAiConfig ( ai.url, env[ ai.token ], ai.model ) ) ( [ { role: 'system', content: 'test' } ] )
          console.log ( `    ${ai.url} is reachable` )
        } catch ( e: any ) {
          console.log ( `    ${ai.url} is not reachable` )
          console.log ( `   error is`, e )
        }
      }
      await validateDirectories ( tc.config.directories )
      async function validateTika ( tika: SummariseTika ) {
        console.log ( 'tika' )
        try {
          await fs.promises.access ( tika.jar )
          console.log ( `    ${tika.jar} exists` )
        } catch ( e ) {
          console.log ( `    ${tika.jar} does not exist` )
        }
      }
      await validateTika ( tc.config.tika )
      await validateOpenAiConnectivity ( tc.context.env, tc.config.ai )
    }
  }

}
export function ksCommands<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig>,
                                                cliTc: CliTc<Commander, SummariseContext, Config, SummariseConfig> ) {
  cliTc.addCommands ( tc, [
    addValidateCommand ( tc ),
    addInputsCommand ( tc ),
    addTikaCommand ( tc ),
    addTextCommand ( tc ),
    addSummaryCommand ( tc ),
    addReportCommand ( tc )
  ] )
}
