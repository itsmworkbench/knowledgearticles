import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

async function* getChildDirectories ( dir: string, filterFn?: ( name: string ) => boolean ): AsyncGenerator<string> {
  const dirEntries = await fs.readdir ( dir, { withFileTypes: true } );
  for ( const entry of dirEntries.sort () ) {
    const fullPath = path.join ( dir, entry.name );
    if ( entry.isDirectory () ) {
      if ( !filterFn || filterFn ( entry.name ) ) {
        yield fullPath;
      }
      yield* getChildDirectories ( fullPath, filterFn );
    }
  }
}
export async function* getDirectoriesRecursively ( dir: string, filterFn?: ( name: string ) => boolean ): AsyncGenerator<string> {
  yield dir
  for await ( const child of getChildDirectories ( dir, filterFn ) )
    yield child
}

export async function* getFilesRecursively ( dir: string, filterFn?: ( name: string ) => boolean ): AsyncGenerator<string> {
  const dirEntries = await fs.readdir ( dir, { withFileTypes: true } );

  for ( const entry of dirEntries.sort () ) {
    const fullPath = path.join ( dir, entry.name );
    if ( entry.isDirectory () ) {
      yield* getFilesRecursively ( fullPath, filterFn );
    } else if ( entry.isFile () ) {
      if ( !filterFn || filterFn ( entry.name ) ) {
        yield fullPath;
      }
    }
  }
}

export async function mapAsyncG<T, T1> ( gen: AsyncGenerator<T>, fn: ( t: T ) => Promise<T1> ): Promise<T1[]> {
  const res: Promise<T1>[] = []
  for await ( const t of gen ) res.push ( fn ( t ) )
  return Promise.all ( res )
}


export const changeExtension = ( newExt: string ) => ( s: string, ) => s.replace ( /\.[^/.]+$/, newExt );

export type TranformFilesMetric = {
  readCount: number
  writeCount: number
  failed: string[]
  markerErrors: string[]
}
export function addMetrics ( metrics: TranformFilesMetric[] ): TranformFilesMetric {
  return metrics.reduce ( ( acc, m ) => ({
    readCount: acc.readCount + m.readCount,
    writeCount: acc.writeCount + m.writeCount,
    failed: [ ...acc.failed, ...m.failed ],
    markerErrors: [ ...acc.markerErrors, ...m.markerErrors ]
  }), { readCount: 0, writeCount: 0, failed: [], markerErrors: [] } )
}
export type TranformFiles = ( config: TransformFilesConfig ) => Promise<TranformFilesMetric>

export const inputToOutputFileName = ( inputDir: string, outputDir: string, config?: TransformFilesConfig ) => ( file: string, index: number ) => {
  const { newFileNameFn = ( f: string, index: number ) => f } = config || {}
  const relativePath = path.relative ( inputDir, newFileNameFn ( file, index ) );
  const outputFilePath = path.join ( outputDir, relativePath );
  return outputFilePath;
};

export type MarkerFn = ( config: TransformFilesConfig, file: string ) => Promise<string | undefined>
export type TransformFilesConfig = {
  inputDir: string,
  outputDir: string,
  fn: ( file: string, marker: string | undefined ) => Promise<FileAndContent[]>
  markerFn?: MarkerFn
  filter?: ( file: string ) => boolean
  newFileNameFn?: ( file: string, index: number ) => string
  dryRun?: boolean
  debug?: boolean
}

export const markerIsFromOldFile = ( findMarker: ( fileName: string, content: string ) => string | undefined ): MarkerFn =>
  async ( config: TransformFilesConfig, file: string ) => {
    const { inputDir, outputDir } = config
    const outputFilePath = inputToOutputFileName ( inputDir, outputDir, config ) ( file, 0 );
    const oldOutput = await fs.readFile ( outputFilePath, 'utf-8' ).catch ( () => undefined )
    const marker = (oldOutput != undefined) && findMarker ( file, oldOutput )
    return marker
  };

export const markerIsFromJsonInOldFile = ( findMarker: ( json: any ) => string | undefined ): MarkerFn =>
  markerIsFromOldFile ( ( content: string ) => findMarker ( JSON.parse ( content ) ) )

export const markerIsFieldInOldFile = ( field: string ): MarkerFn =>
  markerIsFromJsonInOldFile ( ( content: any ) => content?.[ field ] )

export const markerIsShaInOldFile: MarkerFn = markerIsFieldInOldFile ( 'sha' )

type FileAndContent = {
  file: string
  content: string
}
async function findMarker (config: TransformFilesConfig, metrics: TranformFilesMetric, file: string) {
  const { markerFn, debug } = config
  try {
    return (markerFn !== undefined) && await markerFn ( config, file );
  } catch ( e: any ) {
    if ( debug ) console.error ( e )
    metrics.markerErrors.push ( file )
  }
}
const transformOneFile = ( config: TransformFilesConfig ) => {
  const { fn, debug, dryRun, markerFn, newFileNameFn = (f => f) } = config
  return async ( file: string ) => {
    const metrics: TranformFilesMetric = { readCount: 0, writeCount: 0, failed: [], markerErrors: [] }
    try {
      const content: string = await fs.readFile ( file, 'utf-8' );
      const marker = await findMarker (config, metrics, file)
      if ( debug || dryRun ) console.log ( 'file', file, 'marker', marker )
      const newContent = await fn ( content, marker );
      for ( const { file, content } of newContent ) {
        const newDir = path.dirname ( file );
        await fs.mkdir ( newDir, { recursive: true } );
        await fs.writeFile ( file, content );
        metrics.writeCount++;
      }
      metrics.readCount++;
    } catch ( e: any ) {
      if ( e.name === 'AxiosError' )
        console.error ( `Failed`, file )
      else
        console.error ( `Failed`, file, e )
      metrics.failed.push ( file )
    }
    return metrics
  };
}
export const transformFiles: TranformFiles = async ( config: TransformFilesConfig ) =>
  addMetrics ( await mapAsyncG ( getFilesRecursively ( config.inputDir, config.filter ), transformOneFile ( config ) ) );


export type TransformShaConfig = {
  digest?: Digest
  getShaFromOutput: ( s: string ) => Promise<string | undefined>

}

export type TransformDirectoryIfShaChangedConfig = TransformFilesConfig & TransformShaConfig

export const transformFilesIfShaChanged: TranformFiles = ( config: TransformDirectoryIfShaChangedConfig ) => {
  const { fn, digest, getShaFromOutput, ...rest } = config
  const newFn = async ( content: string, marker: string | undefined ) => {
    const thisSha = await digest ( content )
    if ( marker === thisSha ) return []
    return fn ( content, marker )
  }
  return transformFiles ( { ...rest, fn: newFn } )
};

export type Digest = ( s: string ) => Promise<string>

export const calculateSHA256: Digest = async ( s: string ): Promise<string> => {
  const hashSum = createHash ( 'sha256' );
  hashSum.update ( s );
  return hashSum.digest ( 'base64url' );
};
