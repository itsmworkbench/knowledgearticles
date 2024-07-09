import axios, { AxiosInstance, AxiosStatic } from "axios";


export type Message = {
  content: string;
  role: 'user' | 'system' | 'assistant';
};
export type AiClient = ( prompt: Message[] ) => Promise<Message[]>

export type OpenAiConfig = {
  axios: AxiosInstance,
  model?: string
  //Any customisation for the call. See https://platform.openai.com/docs/api-reference/chat/create
  customisation?: any
  debug?: boolean
}

export const openAiClient = ( config: OpenAiConfig, ): AiClient => {
  let { axios, model, customisation, debug } = config
  if ( !model ) model = "davinci"
  if ( !customisation ) customisation = {}
  return async ( messages: Message[] ): Promise<Message[]> => {
    if ( debug ) console.log ( 'openAiMessagesClient', messages )
    const response = await axios.post ( `/v1/chat/completions`, {
      model,
      messages,
      ...customisation
    } );
    return response.data.choices.map ( ( x: any ) => x.message );
  }
}


export const defaultOpenAiConfig = ( baseURL: string, token: string, model: string, axios: AxiosStatic, addInterceptors: ( a: AxiosInstance ) => void ): OpenAiConfig => {
  if ( !baseURL ) throw new Error ( 'baseURL is required for open ai. Have you set up the .env file?' );
  if ( !model ) model = "davinci"
  const Authorization = `Bearer ${token}`
  const axiosInstance = axios.create ( {
    baseURL,
    headers: {
      Authorization,
      'Content-Type': 'application/json',
    },
  } );
  addInterceptors ( axiosInstance )
  return {
    axios: axiosInstance,
    model
  };
}

