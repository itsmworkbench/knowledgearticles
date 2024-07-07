#!/usr/bin/env node
import { CliTc, CliTcFinder, fileConfig, makeCli } from "@itsmworkbench/cli";
import { Commander12, commander12Tc } from "@itsmworkbench/commander12";
import { hasErrors, reportErrors } from "@laoban/utils";
import { fileOpsNode } from "@laoban/filesops-node";
import { SummariseContext } from "./src/summarise.context";
import { ksCommands } from "./src/summarise.commands";
import { defaultOpenAiConfig, openAiClient } from "@summarisation/openai";
import { SummariseConfig, validateConfig } from "./src/summarise.config";
import { jsYaml } from "@itsmworkbench/jsyaml";

export function findVersion () {
  let packageJsonFileName = "../package.json";
  try {
    return require ( packageJsonFileName ).version
  } catch ( e ) {
    return "version not known"
  }
}

export type NoConfig = {}


let fileOps = fileOpsNode ();
const makeContext = (): SummariseContext => ({
  version: findVersion (), name: 'summarise',
  currentDirectory: process.cwd (),
  env: process.env,
  fileOps,
  args: process.argv
});

export const cliTc: CliTc<Commander12, SummariseContext, SummariseConfig, SummariseConfig> =
               commander12Tc<SummariseContext, SummariseConfig, SummariseConfig> ()

const yamlLoader = ( context: string ) => ( s: string ) => {
  let result = jsYaml ().parser ( s );
  if ( hasErrors ( result ) ) {
    console.log ( context )
    result.forEach ( e => console.log ( e ) )
    process.exit ( 2 )
  }
  return result
}

export const configFinder: CliTcFinder<SummariseConfig, SummariseConfig> =
               fileConfig ( 'summarise.yaml', validateConfig, name =>
                 Promise.resolve ( [ `File ${name} not found in current directory or any parent directory` ] ), yamlLoader
               )
makeCli<Commander12, SummariseContext, SummariseConfig, SummariseConfig> ( makeContext (), configFinder, cliTc ).then (
  async ( commander ) => {
    if ( hasErrors ( commander ) ) {
      reportErrors ( commander )
      process.exit ( 1 )
    }
    ksCommands ( commander, cliTc )
    // cliTc.addSubCommand ( commander, configCommands ( commander ) as any )
    return await cliTc.execute ( commander.commander, process.argv )
  } ).catch ( e => {
  console.error ( e )
  process.exit ( 1 )
} )