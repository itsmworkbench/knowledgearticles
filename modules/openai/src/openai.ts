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


export const defaultOpenAiConfig = ( baseURL: string, token: string, model: string ): OpenAiConfig => {
  return {
    axios,
    baseURL,
    Authorization: `Bearer ${token}`,
    model
  };
}

