import axios from 'axios';
import { Digest, DigestBuffer } from "@summarisation/fileutils";

export type TikaClient = {
  host: string;
  port: number;
  digest?: DigestBuffer
};
export async function findType ( config: TikaClient, documentBuffer: Buffer ): Promise<string> {
  const url = `http://${config.host}:${config.port}/detect/stream`;

  try {
    const response = await axios.put ( url, documentBuffer, {
      headers: {},
      responseType: 'text'
    } );

    return response.data;
  } catch ( error ) {
    throw new Error ( `Failed to find type: ${error.message}` );
  }

}
export async function processDocument ( config: TikaClient, documentBuffer: Buffer ): Promise<string> {
  const url = `http://${config.host}:${config.port}/tika`;
  const contentType = await findType ( config, documentBuffer );
  try {
    const response = await axios.put ( url, documentBuffer, {
      headers: {
        // 'Accept': 'application/json',
        "Content-Type": contentType
      },
      responseType: 'text'
    } );

    let result = response.data;
    if ( config.digest ) {
      const sha = await config.digest ( Buffer.from ( result ) );
      result = result.replace ( /<head>/, `<head>\n    <meta name="sha" sha="${await config.digest ( documentBuffer )}"/>` );
    }
    return result;
  } catch ( error ) {
    throw new Error ( `Failed to process document: ${error.message}` );
  }
}