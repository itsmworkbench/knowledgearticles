import { ActionFn, CliTc, CommandDetails, ContextConfigAndCommander } from "@itsmworkbench/cli";
import { SummariseContext } from "./summarise.context";
import { calculateSHA256, changeExtension, ExecuteConfig, executeRecursivelyCmdChanges, getFilesRecursively, inputToOutputFileName, TransformDirectoryIfShaChangedConfig, transformFiles, transformFilesIfShaChanged } from "@summarisation/fileutils";
import * as fs from "node:fs";
import * as cheerio from "cheerio";
import { defaultOpenAiConfig, Message, openAiClient } from "@summarisation/openai";
import { configToThrottling, SummariseConfig } from "./summarise.config";
import { simpleTemplate } from "@itsmworkbench/utils";
import { NameAnd } from "@laoban/utils";
import path from "node:path";
import { startThrottling, stopThrottling, Task, Throttling, withConcurrencyLimit, withRetry, withThrottle } from "@summarisation/kleislis";


function inputsAction<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): ActionFn<Commander> {
  return async ( _, opts ) => {
    if ( opts.debug ) console.log ( `tika `, opts )
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
export function ksCommands<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig>,
                                                cliTc: CliTc<Commander, SummariseContext, Config, SummariseConfig> ) {
  cliTc.addCommands ( tc, [
    addInputsCommand ( tc ),
    addTikaCommand ( tc ),
    addTextCommand ( tc ),
    addSummaryCommand ( tc ),
    addReportCommand ( tc )
  ] )
}
