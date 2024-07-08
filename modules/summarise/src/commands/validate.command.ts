import { CommandDetails, ContextConfigAndCommander } from "@itsmworkbench/cli";
import { SummariseContext } from "../summarise.context";
import { SummariseAi, SummariseConfig, SummariseDirectories, SummariseTika } from "../summarise.config";
import fs from "node:fs";
import { NameAnd } from "@laoban/utils";
import { defaultOpenAiConfig, openAiClient } from "@summarisation/openai";

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