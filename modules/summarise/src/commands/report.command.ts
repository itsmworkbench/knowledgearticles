import { ActionFn, CommandDetails, ContextConfigAndCommander } from "@itsmworkbench/cli";

import { NameAnd } from "@laoban/utils";
import { getFilesRecursively } from "@summarisation/fileutils";
import fs from "node:fs";
import path from "node:path";
import { SummariseContext } from "../summarise.context";
import { SummariseConfig } from "../summarise.config";

export function reportAction<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): ActionFn<Commander> {
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