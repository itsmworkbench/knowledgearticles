import { CliTc, CommandDetails, ContextConfigAndCommander } from "@itsmworkbench/cli";
import { KAContext } from "./ka.context";
import { changeExtension, ExecuteConfig, executeRecursivelyCmdChanges, inputToOutputFileName, transformFiles, TransformFilesConfig } from "@itsmworkbench/fileutils";
import path from "node:path";
import * as fs from "node:fs";
import * as cheerio from "cheerio";
import { basePrompt, defaultOpenAiConfig, Message, openAiClient } from "@enterprise_search/openai";


export function addTika<Commander, Config, CleanConfig> ( tc: ContextConfigAndCommander<Commander, KAContext, Config, CleanConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'tika',
    description: `turn pdf files into text files using apache tika`,
    options: {
      '-j, --jar <jar>': { description: 'The jar file to use', default: 'tika-app-2.9.2.jar' },
      '-d, --dir <dir>': { description: 'The directory to look for the pdf files', default: 'knowledgearticles/pdfs' },
      '-t, --target <target>': { description: 'The directory to put the text files', default: 'knowledgearticles/tika' },
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: async ( _, opts ) => {
      if ( opts.debug ) console.log ( `tika `, opts )
      const dir = opts.dir as string
      const target = opts.target as string
      if ( opts.clean ) await fs.promises.rm ( target, { recursive: true } )
      const jar = path.resolve ( opts.jar as string )
      const config: ExecuteConfig = {
        debug: opts.debug === true,
        dryRun: opts.dryRun === true
      }
      const inToOutName = inputToOutputFileName ( dir, target, { newFileNameFn: changeExtension ( '.json' ) } )
      console.log ( await executeRecursivelyCmdChanges ( tc.context.currentDirectory, dir, dir => {
        let outDir = inToOutName ( dir );
        return `java -jar ${jar} -i ${dir} -o ${outDir} --jsonRecursive`;
      }, config ) )
    }
  }
}
export function addHtmlCommand<Commander, Config, CleanConfig> ( tc: ContextConfigAndCommander<Commander, KAContext, Config, CleanConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'html',
    description: `turn tika files to html files`,
    options: {
      '-d, --dir <dir>': { description: 'The directory to look for the tika files', default: 'knowledgearticles/tika' },
      '-t, --target <target>': { description: 'The directory to put the html files', default: 'knowledgearticles/html' },
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: async ( _, opts ) => {
      if ( opts.debug ) console.log ( `html `, opts )
      const dir = opts.dir as string
      const target = opts.target as string
      if ( opts.clean ) await fs.promises.rm ( target, { recursive: true } )
      const config: TransformFilesConfig = {
        filter: ( file: string ) => file.endsWith ( '.json' ),
        newFileNameFn: changeExtension ( '.html' ),
        debug: opts.debug === true,
        dryRun: opts.dryRun === true
      }
      console.log ( await transformFiles ( fn =>
          JSON.parse ( fn ).map ( page => page[ "X-TIKA:content" ] )
        , config ) ( dir, target ) )
    }
  }
}

export function addTextCommand<Commander, Config, CleanConfig> ( tc: ContextConfigAndCommander<Commander, KAContext, Config, CleanConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'text',
    description: `turn html files to text`,
    options: {
      '-d, --dir <dir>': { description: 'The directory to look for the html files', default: 'knowledgearticles/html' },
      '-t, --target <target>': { description: 'The directory to put the text files', default: 'knowledgearticles/text' },
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: async ( _, opts ) => {
      if ( opts.debug ) console.log ( `text `, opts )
      const dir = opts.dir as string
      const target = opts.target as string
      if ( opts.clean ) await fs.promises.rm ( target, { recursive: true } )
      const config: TransformFilesConfig = {
        filter: ( file: string ) => file.endsWith ( '.html' ),
        newFileNameFn: changeExtension ( '.txt' ),
        debug: opts.debug === true,
        dryRun: opts.dryRun === true
      }
      console.log ( await transformFiles ( async f => {
        let $ = cheerio.load ( f );
        return $ ( 'body' ).text ()
      }, config ) ( dir, target ) )
    }
  }
}


export function addSummaryCommand<Commander, Config, CleanConfig> ( tc: ContextConfigAndCommander<Commander, KAContext, Config, CleanConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'summary',
    description: `turn text files to summary`,
    options: {
      '-d, --dir <dir>': { description: 'The directory to look for the text files', default: 'knowledgearticles/text' },
      '-t, --target <target>': { description: 'The directory to put the summary files', default: 'knowledgearticles/summary' },
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: async ( _, opts ) => {
      if ( opts.debug ) console.log ( `text `, opts )
      const dir = opts.dir as string
      const target = opts.target as string
      if ( opts.clean ) await fs.promises.rm ( target, { recursive: true } )
      const config: TransformFilesConfig = {
        filter: ( file: string ) => file.endsWith ( '.txt' ),
        newFileNameFn: changeExtension ( '.json' ),
        debug: opts.debug === true,
        dryRun: opts.dryRun === true
      }
      console.log ( await transformFiles ( async f => {
        let prompt: Message[] = [ { role: 'system', content: `${basePrompt}\n\nThe Knowledge Article is \n${f}` } ];
        if ( opts.dryRun || opts.debug ) console.log ( 'prompt', prompt )
        if ( opts.dryRun ) return undefined
        let choices = await tc.context.openai ( prompt );
        let result = choices.map(m=>m.content).join ( '\n' );
        return result
      }, config ) ( dir, target ) )
    }
  }
}


export function ksCommands<Commander, Config, CleanConfig> ( tc: ContextConfigAndCommander<Commander, KAContext, Config, CleanConfig>,
                                                             cliTc: CliTc<Commander, KAContext, Config, CleanConfig> ) {
  cliTc.addCommands ( tc, [
    addTika ( tc ),
    addHtmlCommand ( tc ),
    addTextCommand ( tc ),
    addSummaryCommand ( tc )
  ] )
}
