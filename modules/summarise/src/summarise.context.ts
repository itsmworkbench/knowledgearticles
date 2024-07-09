import { CliContext } from "@itsmworkbench/cli";
import { AxiosInstance, AxiosStatic } from "axios";

export interface SummariseContext extends CliContext {
  axios: AxiosStatic
  addAxiosInterceptors: ( a: AxiosInstance ) => void

}
