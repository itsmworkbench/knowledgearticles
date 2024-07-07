import axios, { AxiosStatic } from "axios";
import { NameAnd } from "@laoban/utils";


export type Message = {
  content: string;
  role: 'user' | 'system' | 'assistant';
};
export type AiClient = ( prompt: Message[] ) => Promise<Message[]>

export type OpenAiConfig = {
  axios: AxiosStatic,
  baseURL?: string
  Authorization: string,
  model?: string
  //Any customisation for the call. See https://platform.openai.com/docs/api-reference/chat/create
  customisation?: any
  debug?: boolean
}

export const openAiClient = ( config: OpenAiConfig, ): AiClient => {
  let { axios, baseURL, Authorization, model, customisation, debug } = config
  if ( !baseURL ) throw new Error ( 'baseURL is required for open ai. Have you set up the .env file?' );
  if ( !model ) model = "davinci"
  if ( !customisation ) customisation = {}
  const axiosInstance = axios.create ( {
    baseURL,
    headers: {
      Authorization,
      'Content-Type': 'application/json',
    },
  } );
  return async ( messages: Message[] ): Promise<Message[]> => {
    if ( debug ) console.log ( 'openAiMessagesClient', messages )
    try {
      const response = await axiosInstance.post ( `/v1/chat/completions`, {
        model,
        messages,
        ...customisation
      } );
      return response.data.choices.map ( ( x: any ) => x.message );
    } catch ( error ) {
      console.error ( 'Error calling openai:', messages, error );
      throw error;
    }
  }
}


export const basePrompt = `I want you to evaluate a Knowledge Article for an ITSM issue using the following four areas

Definition of good

description: Do we have a clear description of what the issue is that this KEDB is about? Red/Orange/Green
detection: Do we have a clear technical mechanism to determine that the issue exists. For example sql calls, api calls and so on
and if we do, do we have enough information. For example with sql we need database connection details. For apis we need the urls
resolution: Do we have a clear technical mechanism to resolve the issue. Same example issues (ie. sql needs conneciton issues)
validation: Do we have a clear technical mechanism to validate that we have resolved the issue
The results will be used in RAG, so please provide a json object  with the name of the section (the description, detection, resolution and validation) 
each section is an object having two fields called 'value' and 'summary'. The first is  a  traffic light value, and the second a summary of why that value was chosen.
In addition create a final object called 'summary' with the same two fields which score the whole based on the traffic light values, and give a summary about the quality of the KEDB entry.
`

export const defaultOpenAiConfig = ( baseURL: string, token: string, model: string ): OpenAiConfig => {
  return {
    axios,
    baseURL,
    Authorization: `Bearer ${token}`,
    model
  };
}

