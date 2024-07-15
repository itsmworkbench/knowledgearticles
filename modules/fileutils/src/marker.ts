import { inputToOutputFileName, TranformFilesMetric, TransformFilesConfig } from "./files";

export type MarkerFn = ( config: TransformFilesConfig, file: string ) => Promise<string | undefined>
export const markerIsFromOldFile = ( findMarker: ( fileName: string, content: string ) => string | undefined ): MarkerFn =>
  async ( config: TransformFilesConfig, file: string ) => {
    const { inputDir, outputDir } = config
    const outputFilePath = inputToOutputFileName ( inputDir, outputDir, config ) ( file, 0 );
    const oldOutput = await config.readFile ( outputFilePath ).catch ( () => undefined )
    const marker = oldOutput === undefined ? undefined : findMarker ( file, oldOutput )
    return marker
  };

export const markerIsFromJsonInOldFile = ( findMarker: ( json: any ) => string | undefined ): MarkerFn =>
  markerIsFromOldFile ( ( filename, content: string ) => findMarker ( JSON.parse ( content ) ) )

export const markerIsFieldInOldFile = ( field: string ): MarkerFn =>
  markerIsFromJsonInOldFile ( ( content: any ) => content?.[ field ] )

export const markerIsShaInOldFile: MarkerFn = markerIsFieldInOldFile ( 'sha' )

export async function findMarker ( config: TransformFilesConfig, metrics: TranformFilesMetric, file: string ): Promise<string | undefined> {
  const { markerFn, debug } = config
  try {
    return markerFn === undefined ? undefined : await markerFn ( config, file );
  } catch ( e: any ) {
    if ( debug ) console.error ( e )
    metrics.markerErrors.push ( file )
  }
}

export const markerFromHtml: MarkerFn = async ( config: TransformFilesConfig, file: string ) => {
  const { readFile } = config;
  const content = await readFile ( file );
  const match = content.match ( /<meta name="sha" sha="([^"]*)"/ );
  return match ? match[ 1 ] : undefined;
}


