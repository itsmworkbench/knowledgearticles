import { CliTc, CommandDetails, ContextConfigAndCommander } from "@itsmworkbench/cli";

import { addInputsCommand, inputsAction } from "./inputs.command";
import { addTikaCommand, tikaAction } from "./tika.command";
import { addTextCommand, textAction } from "./text.command";
import { addReportCommand, reportAction } from "./report.command";
import { addValidateCommand } from "./validate.command";
import { SummariseContext } from "../summarise.context";
import { SummariseConfig } from "../summarise.config";


export function addSummaryCommand<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig> ): CommandDetails<Commander> {
  return {
    cmd: 'summary',
    description: `Does everything: turns pdfs => html => text => summary`,
    options: {
      '--clean': { description: 'Delete the output file directories at the start' },
      '--debug': { description: 'Show debug information' },
      '--noReport': { description: `Don't make a report` },
      '--dryRun': { description: `Just do a dry run instead of actually making the pipelines` }
    },
    action: async ( c, opts ) => {
      await inputsAction ( tc ) ( c, opts )
      await tikaAction ( tc ) ( c, opts )
      await textAction ( tc ) ( c, opts )
      if ( !opts.noReport ) await reportAction ( tc ) ( c, opts )
    }
  }
}


export function addAllSummaryCommands<Commander, Config> ( tc: ContextConfigAndCommander<Commander, SummariseContext, Config, SummariseConfig>,
                                                           cliTc: CliTc<Commander, SummariseContext, Config, SummariseConfig> ) {
  cliTc.addCommands ( tc, [
    addValidateCommand ( tc ),
    addInputsCommand ( tc ),
    addTikaCommand ( tc ),
    addTextCommand ( tc ),
    addSummaryCommand ( tc ),
    addReportCommand ( tc )
  ] )
}
