import { ActionFn, CommandDetails, ContextConfigAndCommander } from "@itsmworkbench/cli";
import { SummariseContext } from "../summarise.context";
import { abortIfDirectoryDoesNotExist, SummariseConfig } from "../summarise.config";
import fs from "node:fs";
import { changeExtension, changeExtensionAddIndex, FileAndContent, transformFiles, TransformFilesConfig, TransformOneFileFn } from "@summarisation/fileutils";
import cheerio from "cheerio";
import { splitAndCapitalize } from "@itsmworkbench/utils";
import { uppercaseFirstLetter } from "@itsmworkbench/utils/dist/src/strings";
import { debug } from "node:util";

export function tikaAction<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): ActionFn<Commander> {
  return async ( _, opts ) => {
    if ( opts.debug ) console.log ( `html `, opts )
    await abortIfDirectoryDoesNotExist ( tc.config.directories.tika, `tika directory ${tc.config.directories.tika} does not exist` )
    await fs.promises.mkdir ( tc.config.directories.text, { recursive: true } )
    const {
            tika, text
          } = tc.config.directories
    if ( opts.clean ) await fs.promises.rm ( text, { recursive: true } )

    const type = `onePer${uppercaseFirstLetter ( opts.onePer?.toString ()||tc.config.transform.type )}`
    if ( debug ) console.log ( 'type', type )
    const fn: TransformOneFileFn = async ( content: string, marker: string | undefined, newFilename ): Promise<FileAndContent[]> => {
      let contents: string[] = JSON.parse ( content ).flatMap ( ( page: any, index: number ) => {
        let html = page[ "X-TIKA:content" ];
        if ( html === undefined ) return ''
        if ( typeof html !== 'string' ) throw new Error ( `Expected string got ${typeof html}` )
        let $ = cheerio.load ( html );
        return $ ( 'body' ).text ()
      } );

      const result: FileAndContent[] = type === 'onePerPage' ?
        contents.map ( ( content, index ) => ({ file: newFilename ( index ), content }) )
        : [ { file: newFilename ( 0 ), content: contents.join ( '\n' ) } ]
      return result.filter ( ( { content } ) => content !== undefined && content !== null && content.trim ().length > 0 );
    };
    const config: TransformFilesConfig = {
      inputDir: tika,
      outputDir: text,
      fn,
      readFile: async ( file: string ) => fs.readFileSync ( file, 'utf8' ),
      filter: ( file: string ) => file.endsWith ( '.json' ),
      newFileNameFn: changeExtensionAddIndex ( '.txt' ),
      debug: opts.debug === true,
      dryRun: opts.dryRun === true
    }
    console.log ( 'made html files', await transformFiles ( config ) )
  };
}
export function addTikaCommand<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'tika',
    description: `turn tika files to text files ${tc.config.directories.tika} ==> ${tc.config.directories.text}`,
    options: {
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--onePer <type>': { description: `One file per page or per file. Legal values 'page' or  'default'. overrides config`, default: tc.config.transform.type },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: tikaAction ( tc )
  }
}