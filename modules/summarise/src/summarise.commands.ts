import { ActionFn, CliTc, CommandDetails, ContextConfigAndCommander } from "@itsmworkbench/cli";
import { SummariseContext } from "./summarise.context";
import { calculateSHA256, changeExtension, ExecuteConfig, executeRecursivelyCmdChanges, getFilesRecursively, inputToOutputFileName, TransformDirectoryIfShaChangedConfig, transformFiles, TransformFilesConfig, transformFilesIfShaChanged } from "@summarisation/fileutils";
import * as fs from "node:fs";
import * as cheerio from "cheerio";
import { defaultOpenAiConfig, Message, openAiClient } from "@summarisation/openai";
import { SummariseConfig } from "./summarise.config";
import { simpleTemplate } from "@itsmworkbench/utils";
import { NameAnd } from "@laoban/utils";
import path from "node:path";


function pdfsAction<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): ActionFn<Commander> {
  return async ( _, opts ) => {
    if ( opts.debug ) console.log ( `tika `, opts )
    const { pdfs, tika } = tc.config.directories
    const { jar } = tc.config.tika

    if ( opts.clean ) await fs.promises.rm ( tika, { recursive: true } )

    const config: ExecuteConfig = {
      debug: opts.debug === true,
      dryRun: opts.dryRun === true
    }
    const inToOutName = inputToOutputFileName ( pdfs, tika, { newFileNameFn: changeExtension ( '.json' ) } )

    console.log ( 'made tika files', await executeRecursivelyCmdChanges ( tc.context.currentDirectory, pdfs, dir => {
      let outDir = inToOutName ( dir );
      return `java -jar ${jar} -i ${dir} -o ${outDir} --jsonRecursive`;
    }, config ) )
  };
}
export function addPdfs<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'pdfs',
    description: `turn pdf files into text files using apache tika`,
    options: {
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: pdfsAction ( tc )
  }
}
function addTikaAction<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): ActionFn<Commander> {
  return async ( _, opts ) => {
    if ( opts.debug ) console.log ( `html `, opts )
    const { tika, html } = tc.config.directories
    if ( opts.clean ) await fs.promises.rm ( html, { recursive: true } )

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
      newFileNameFn: changeExtension ( '.html' ),
      debug: opts.debug === true,
      dryRun: opts.dryRun === true
    }
    console.log ( 'made html files', await transformFiles ( fn =>
        JSON.parse ( fn ).map ( ( page: any ) => page[ "X-TIKA:content" ] )
      , config ) ( tika, html ) )
  };
}
export function addTikaCommand<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'tika',
    description: `turn tika files to html files`,
    options: {
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: addTikaAction ( tc )
  }
}

function htmlAction<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): ActionFn<Commander> {
  return async ( _, opts ) => {
    if ( opts.debug ) console.log ( `text `, opts )
    const { html, text } = tc.config.directories
    if ( opts.clean ) await fs.promises.rm ( text, { recursive: true } )
    const config: TransformFilesConfig = {
      filter: ( file: string ) => file.endsWith ( '.html' ),
      newFileNameFn: changeExtension ( '.txt' ),
      debug: opts.debug === true,
      dryRun: opts.dryRun === true
    }
    console.log ( 'make text files', await transformFiles ( async f => {
      let $ = cheerio.load ( f );
      return $ ( 'body' ).text ()
    }, config ) ( html, text ) )
  };
}
export function addHtmlCommand<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'html',
    description: `turn html files to text`,
    options: {
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: htmlAction ( tc )
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

    console.log ( 'made summary files', await transformFilesIfShaChanged ( async ( f, sha ) => {
      const content = simpleTemplate ( tc.config.prompt, { knowledgeArticle: f } )
      let prompt: Message[] = [ { role: 'system', content } ];
      if ( opts.dryRun || opts.debug ) console.log ( 'prompt', prompt )
      if ( opts.dryRun ) return undefined
      let choices = await openai ( prompt );
      let chosen = choices.map ( m => m.content ).join ( '\n' );
      const json = JSON.parse ( chosen )
      return JSON.stringify ( { sha, ...json }, null, 2 )
    }, config ) ( text, summary ) )
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
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: async ( c, opts ) => {
      await pdfsAction ( tc ) ( c, opts )
      await htmlAction ( tc ) ( c, opts )
      await textAction ( tc ) ( c, opts )
    }
  }
}

export function addReportCommand<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'report',
    description: `Scans the summaries and reports on their quality `,
    options: {
      '--debug': { description: 'Show debug information' }
    },
    action: async ( c, opts ) => {
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
    }
  }
}
export function ksCommands<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig>,
                                                cliTc: CliTc<Commander, SummariseContext, Config, SummariseConfig> ) {
  cliTc.addCommands ( tc, [
    addPdfs ( tc ),
    addTikaCommand ( tc ),
    addHtmlCommand ( tc ),
    addTextCommand ( tc ),
    addSummaryCommand ( tc ),
    addReportCommand ( tc )
  ] )
}
