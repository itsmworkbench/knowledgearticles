import axios, { AxiosStatic } from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { defaultOpenAiConfig, Message, openAiClient, OpenAiConfig } from "./openai";


describe ( 'openAiClient', () => {
  let mock: MockAdapter;
  let config: OpenAiConfig;

  const baseURL = 'https://api.openai.com';
  const Authorization = 'Bearer test-token';
  beforeEach ( () => {
    mock = new MockAdapter ( axios );
    config = defaultOpenAiConfig ( baseURL, Authorization, 'davinci', axios, ( a ) => {} );
  } );

  it ( 'should use default model if not provided', async () => {
    const client = openAiClient ( { ...config, model: undefined } );
    const messages: Message[] = [ { role: 'user', content: 'Hello!' } ];
    const responseMessage = { role: 'assistant', content: 'Hi there!' };

    mock.onPost ( '/v1/chat/completions' ).reply ( 200, {
      choices: [ { message: responseMessage } ]
    } );

    const response = await client ( messages );

    expect ( response ).toEqual ( [ responseMessage ] );
    expect ( mock.history.post[ 0 ].data ).toContain ( '"model":"davinci"' );
  } );

  it ( 'should call the OpenAI API and return the response messages', async () => {
    const client = openAiClient ( config );
    const messages: Message[] = [ { role: 'user', content: 'Hello!' } ];
    const responseMessage = { role: 'assistant', content: 'Hi there!' };

    mock.onPost ( '/v1/chat/completions' ).reply ( 200, {
      choices: [ { message: responseMessage } ]
    } );

    const response = await client ( messages );

    expect ( response ).toEqual ( [ responseMessage ] );
    expect ( mock.history.post[ 0 ].data ).toContain ( '"model":"davinci"' );
    expect ( JSON.parse ( mock.history.post[ 0 ].data ).messages ).toEqual ( messages );
  } );

  it ( 'should throw an error if the API call fails', async () => {
    const client = openAiClient ( config );
    const messages: Message[] = [ { role: 'user', content: 'Hello!' } ];

    mock.onPost ( '/v1/chat/completions' ).reply ( 500 );

    await expect ( client ( messages ) ).rejects.toThrow ();
  } );

  it ( 'should log debug messages if debug is enabled', async () => {
    const debugConfig = { ...config, debug: true };
    const client = openAiClient ( debugConfig );
    const messages: Message[] = [ { role: 'user', content: 'Hello!' } ];
    const responseMessage = { role: 'assistant', content: 'Hi there!' };

    console.log = jest.fn ();

    mock.onPost ( '/v1/chat/completions' ).reply ( 200, {
      choices: [ { message: responseMessage } ]
    } );

    await client ( messages );

    expect ( console.log ).toHaveBeenCalledWith ( 'openAiMessagesClient', { messages, model: "davinci" } );

  } );
} );


