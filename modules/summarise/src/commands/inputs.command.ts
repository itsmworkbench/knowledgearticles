import { ActionFn, CommandDetails, ContextConfigAndCommander } from "@itsmworkbench/cli";
import { SummariseContext } from "../summarise.context";
import { abortIfDirectoryDoesNotExist, SummariseConfig } from "../summarise.config";
import fs from "node:fs";
import { changeExtension, ExecuteConfig, executeRecursivelyCmdChanges, inputToOutputFileName } from "@summarisation/fileutils";

export function inputsAction<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): ActionFn<Commander> {
  return async ( _, opts ) => {
    if ( opts.debug ) console.log ( `tika `, opts )
    await abortIfDirectoryDoesNotExist ( tc.config.directories.inputs, `inputs directory ${tc.config.directories.inputs} does not exist` )
    const { inputs, tika } = tc.config.directories
    const { jar } = tc.config.tika


    if ( opts.clean ) await fs.promises.rm ( tika, { recursive: true } )

    const config: ExecuteConfig = {
      debug: opts.debug === true,
      dryRun: opts.dryRun === true
    }
    const inToOutName = inputToOutputFileName ( inputs, tika, { newFileNameFn: changeExtension ( '.json' ) } )

    console.log ( 'made tika files', await executeRecursivelyCmdChanges ( tc.context.currentDirectory, inputs, dir => {
      let outDir = inToOutName ( dir );
      return `java -jar ${jar} -i ${dir} -o ${outDir} --jsonRecursive`;
    }, config ) )
  };
}
export function addInputsCommand<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'inputs',
    description: `turn pdf files into text files using apache tika. ${tc.config.directories.inputs} ==> ${tc.config.directories.tika}`,
    options: {
      '--clean': { description: 'Delete the output file directory at the start' },
      '--debug': { description: 'Show debug information' },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: inputsAction ( tc )
  }
}