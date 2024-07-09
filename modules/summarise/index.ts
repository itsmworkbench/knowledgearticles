#!/usr/bin/env node
import { CliTc, CliTcFinder, fileConfig, makeCli } from "@itsmworkbench/cli";
import { Commander12, commander12Tc } from "@itsmworkbench/commander12";
import { hasErrors, NameAnd, reportErrors } from "@laoban/utils";
import { fileOpsNode } from "@laoban/filesops-node";
import { SummariseContext } from "./src/summarise.context";
import { SummariseConfig, validateConfig } from "./src/summarise.config";
import { jsYaml } from "@itsmworkbench/jsyaml";
import { configCommands } from "@itsmworkbench/config";
import * as fs from "node:fs";
import { defaultYaml } from "./src/default.yaml";
import { addAllSummaryCommands } from "./src/commands/summarise.commands";
import axios, { AxiosError, AxiosInstance, AxiosResponse } from "axios";

if ( process.argv[ 2 ] === 'init' ) {
  console.log ( 'init' )
  const force = process.argv[ 3 ] === '--force'
  async function install () {
    try {
      await fs.promises.readFile ( 'summarise.yaml' );
      if ( !force ) {
        console.log ( "Cannot install summarise.yaml as it already exists" )
        process.exit ( 2 )
      }
    } catch ( e: any ) { // we want an error! means not there
    }
    await fs.promises.writeFile ( 'summarise.yaml', defaultYaml )
    console.log ( 'installed summarise.yaml with default values' )
  }
  install ().catch ( e => {
    console.error ( e )
    process.exit ( 2 )
  } )
} else {

  function findVersion () {
    let packageJsonFileName = "../package.json";
    try {
      return require ( packageJsonFileName ).version
    } catch ( e ) {
      return "version not known"
    }
  }


  let fileOps = fileOpsNode ();

  function addAxiosInterceptors ( axios: AxiosInstance ) {
    axios.interceptors.response.use (
      ( response: AxiosResponse ) => {
        // You can log the response details if needed
        return response;
      },
      ( error: AxiosError ) => {
        // Log only the necessary error details
        if ( error.response ) {
          console.error ( `Error response from ${error.config?.url}:`, {
            status: error.response.status,
            data: error.response.data,
          } );
        } else {
          console.error ( 'Error without response:', error.message );
        }
        return Promise.reject ( error );
      }
    );
  }

  const makeContext = (): SummariseContext => ({
    version: findVersion (), name: 'summarise',
    currentDirectory: process.cwd (),
    env: process.env as NameAnd<string>,
    fileOps,
    args: process.argv,
    axios,
    addAxiosInterceptors
  });

  const cliTc: CliTc<Commander12, SummariseContext, SummariseConfig, SummariseConfig> =
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

  const configFinder: CliTcFinder<SummariseConfig, SummariseConfig> =
          fileConfig ( 'summarise.yaml', validateConfig, name =>
            Promise.resolve ( [ `File ${name} not found in current directory or any parent directory` ] ), yamlLoader
          )
  makeCli<Commander12, SummariseContext, SummariseConfig, SummariseConfig> ( makeContext (), configFinder, cliTc ).then (
    async ( commander ) => {
      if ( hasErrors ( commander ) ) {
        reportErrors ( commander )
        process.exit ( 1 )
      }
      addAllSummaryCommands ( commander, cliTc )
      cliTc.addSubCommand ( commander, configCommands ( commander ) as any )
      return await cliTc.execute ( commander.commander, process.argv )
    } ).catch ( e => {
    console.error ( e )
    process.exit ( 1 )
  } )
}