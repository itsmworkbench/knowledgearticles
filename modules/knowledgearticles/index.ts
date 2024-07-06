#!/usr/bin/env node
import { CliTc, fixedConfig, makeCli } from "@itsmworkbench/cli";
import { Commander12, commander12Tc } from "@itsmworkbench/commander12";
import { hasErrors, reportErrors } from "@laoban/utils";
import { fileOpsNode } from "@laoban/filesops-node";
import { KAContext } from "./src/ka.context";
import { ksCommands } from "./src/ka.commands";
import { defaultOpenAiConfig, openAiClient } from "@enterprise_search/openai";

export function findVersion () {
  let packageJsonFileName = "../package.json";
  try {
    return require ( packageJsonFileName ).version
  } catch ( e ) {
    return "version not known"
  }
}

export type NoConfig = {}


const makeContext = (): KAContext => ({
  version: findVersion (), name: 'indexer',
  currentDirectory: process.cwd (),
  env: process.env,
  fileOps: fileOpsNode (),
  args: process.argv,
  openai: openAiClient ( defaultOpenAiConfig )
});

export const cliTc: CliTc<Commander12, KAContext, NoConfig, NoConfig> = commander12Tc<KAContext, NoConfig, NoConfig> ()
export const configFinder = fixedConfig<NoConfig> ( makeContext )
makeCli<Commander12, KAContext, NoConfig, NoConfig> ( makeContext (), configFinder, cliTc ).then ( async ( commander ) => {
  if ( hasErrors ( commander ) ) {
    reportErrors ( commander )
    process.exit ( 1 )
  }
  ksCommands ( commander, cliTc )
  return await cliTc.execute ( commander.commander, process.argv )
} ).catch ( e => {
  console.error ( e )
  process.exit ( 1 )
} )