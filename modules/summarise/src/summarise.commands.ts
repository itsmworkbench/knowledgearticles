import { CliTc, CommandDetails, ContextConfigAndCommander } from "@itsmworkbench/cli";
import { SummariseContext } from "./summarise.context";
import { changeExtension, ExecuteConfig, executeRecursivelyCmdChanges, inputToOutputFileName, transformFiles, TransformFilesConfig } from "@summarisation/fileutils";
import * as fs from "node:fs";
import * as cheerio from "cheerio";
import { defaultOpenAiConfig, Message, openAiClient } from "@summarisation/openai";
import { SummariseConfig } from "./summarise.config";
import { simpleTemplate } from "@itsmworkbench/utils";


export function addPdfs<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'pdfs',
    description: `turn pdf files into text files using apache tika`,
    options: {
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: async ( _, opts ) => {
      if ( opts.debug ) console.log ( `tika `, opts )
      const { pdfs, tika } = tc.config.directories
      const { jar } = tc.config.tika

      if ( opts.clean ) await fs.promises.rm ( tika, { recursive: true } )

      const config: ExecuteConfig = {
        debug: opts.debug === true,
        dryRun: opts.dryRun === true
      }
      const inToOutName = inputToOutputFileName ( pdfs, tika, { newFileNameFn: changeExtension ( '.json' ) } )
      console.log ( await executeRecursivelyCmdChanges ( tc.context.currentDirectory, pdfs, dir => {
        let outDir = inToOutName ( dir );
        return `java -jar ${jar} -i ${dir} -o ${outDir} --jsonRecursive`;
      }, config ) )
    }
  }
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
    action: async ( _, opts ) => {
      if ( opts.debug ) console.log ( `html `, opts )
      const { tika, html } = tc.config.directories
      if ( opts.clean ) await fs.promises.rm ( html, { recursive: true } )

      const config: TransformFilesConfig = {
        filter: ( file: string ) => file.endsWith ( '.json' ),
        newFileNameFn: changeExtension ( '.html' ),
        debug: opts.debug === true,
        dryRun: opts.dryRun === true
      }
      console.log ( await transformFiles ( fn =>
          JSON.parse ( fn ).map ( page => page[ "X-TIKA:content" ] )
        , config ) ( tika, html ) )
    }
  }
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
    action: async ( _, opts ) => {
      if ( opts.debug ) console.log ( `text `, opts )
      const { html, text } = tc.config.directories
      if ( opts.clean ) await fs.promises.rm ( text, { recursive: true } )
      const config: TransformFilesConfig = {
        filter: ( file: string ) => file.endsWith ( '.html' ),
        newFileNameFn: changeExtension ( '.txt' ),
        debug: opts.debug === true,
        dryRun: opts.dryRun === true
      }
      console.log ( await transformFiles ( async f => {
        let $ = cheerio.load ( f );
        return $ ( 'body' ).text ()
      }, config ) ( html, text ) )
    }
  }
}


export function addSummaryCommand<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'summary',
    description: `turn text files to summary`,
    options: {
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: async ( _, opts ) => {
      if ( opts.debug ) console.log ( `text `, opts )
      const { text, summary } = tc.config.directories
      if ( opts.clean ) await fs.promises.rm ( summary, { recursive: true } )
      const config: TransformFilesConfig = {
        filter: ( file: string ) => file.endsWith ( '.txt' ),
        newFileNameFn: changeExtension ( '.json' ),
        debug: opts.debug === true,
        dryRun: opts.dryRun === true
      }
      const { url, token, model } = tc.config.ai
      const tokenValue = tc.context.env[ token ]
      if ( !tokenValue ) throw new Error ( `Environment variable ${token} is required for open ai.` );

      const openai = openAiClient ( defaultOpenAiConfig ( url, tokenValue, model ) )

      console.log ( await transformFiles ( async f => {
        const content = simpleTemplate ( tc.config.prompt, { knowledgeArticle: f } )
        let prompt: Message[] = [ { role: 'system', content } ];
        if ( opts.dryRun || opts.debug ) console.log ( 'prompt', prompt )
        if ( opts.dryRun ) return undefined
        let choices = await openai ( prompt );
        let result = choices.map ( m => m.content ).join ( '\n' );
        return result
      }, config ) ( text, summary ) )
    }
  }
}


export function ksCommands<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig>,
                                                cliTc: CliTc<Commander, SummariseContext, Config, SummariseConfig> ) {
  cliTc.addCommands ( tc, [
    addPdfs ( tc ),
    addTikaCommand ( tc ),
    addHtmlCommand ( tc ),
    addSummaryCommand ( tc )
  ] )
}
