import { ActionFn, CommandDetails, ContextConfigAndCommander } from "@itsmworkbench/cli";
import { SummariseContext } from "../summarise.context";
import { abortIfDirectoryDoesNotExist, SummariseConfig } from "../summarise.config";
import fs from "node:fs";
import { calculateSHA256, changeExtension, TransformDirectoryIfShaChangedConfig, transformFiles } from "@summarisation/fileutils";
import cheerio from "cheerio";

export function tikaAction<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): ActionFn<Commander> {
  return async ( _, opts ) => {
    if ( opts.debug ) console.log ( `html `, opts )
    await abortIfDirectoryDoesNotExist ( tc.config.directories.tika, `tika directory ${tc.config.directories.tika} does not exist` )
    const { tika, text
    } = tc.config.directories
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
          if ( html === undefined ) return ''
          if ( typeof html !== 'string' ) throw new Error ( `Expected string got ${typeof html}` )
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