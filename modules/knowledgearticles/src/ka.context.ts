import { CliContext } from "@itsmworkbench/cli/dist/src/cli";
import { AiClient } from "@enterprise_search/openai";

export interface KAContext extends CliContext {
  openai: AiClient
}
