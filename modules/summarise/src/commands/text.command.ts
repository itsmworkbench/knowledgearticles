import { ActionFn, CommandDetails, ContextConfigAndCommander } from "@itsmworkbench/cli";
import { SummariseContext } from "../summarise.context";

import { abortIfDirectoryDoesNotExist, configToThrottling, SummariseConfig } from "../summarise.config";
import fs from "node:fs";
import { calculateSHA256, changeExtension, TransformDirectoryIfShaChangedConfig, transformFilesIfShaChanged } from "@summarisation/fileutils";
import { defaultOpenAiConfig, Message, openAiClient } from "@summarisation/openai";
import { simpleTemplate } from "@itsmworkbench/utils";
import { startThrottling, stopThrottling, Task, Throttling, withConcurrencyLimit, withRetry, withThrottle } from "@itsmworkbench/kleislis";

export function textAction<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): ActionFn<Commander> {
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

    const { axios, addAxiosInterceptors } = tc.context
    const openai = openAiClient ( defaultOpenAiConfig ( url, tokenValue, model, axios, addAxiosInterceptors ) )


    let transformOne = async ( f: string, sha: string ) => {
      const content = simpleTemplate ( tc.config.prompt, { text: f } )
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
    const withNfcs = opts.noNonFunctionals ? transformOne : withRetry ( retry,
      withThrottle ( throttling,
        withConcurrencyLimit ( tc.config.nonfunctionals.concurrent, queue,
          transformOne ) ) )
    startThrottling ( throttling )
    try {
      console.log ( 'made summary files', await transformFilesIfShaChanged ( withNfcs, config ) ( text, summary ) )
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
      '--noNonFunctionals': { description: 'Do not use non functionals' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: textAction ( tc )
  }
}