import { CliContext } from "@itsmworkbench/cli";
import { AiClient } from "@summarisation/openai";

export interface KAContext extends CliContext {
  openai: AiClient
}
