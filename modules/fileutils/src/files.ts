import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import { findMarker, MarkerFn } from "./marker";

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
export const changeExtensionAddIndex = ( newExt: string ) => ( s: string, index: number ) =>
  s.replace ( /\.[^/.]+$/, '.' + index + newExt );

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

export type InputOutputAndNewFilenameFnDir = {
  inputDir: string
  outputDir: string
  newFileNameFn?: ( file: string, index: number ) => string
}
export const inputToOutputFileName = ( inputDir: string, outputDir: string, config: InputOutputAndNewFilenameFnDir ) => ( file: string, index?: number ) => {
  const { newFileNameFn = ( f: string, index: number ) => f } = config
  if ( index === undefined ) index = 0
  let to = newFileNameFn ( file, index );
  const relativePath = path.relative ( inputDir, to );
  const outputFilePath = path.join ( outputDir, relativePath );
  return outputFilePath;
};

export type TransformOneFileFn = ( file: string, marker: string | undefined, filenameFn: ( index: number ) => string ) => Promise<FileAndContent[]>
export type ReadFileFn = ( file: string ) => Promise<string>
export type TransformFilesConfig = {
  inputDir: string,
  outputDir: string,
  fn: TransformOneFileFn
  readFile: ReadFileFn
  markerFn?: MarkerFn
  filter?: ( file: string ) => boolean
  newFileNameFn?: ( file: string, index: number ) => string
  dryRun?: boolean
  debug?: boolean
}

export type FileAndContent = {
  file: string
  content: string
}
const transformOneFile = ( config: TransformFilesConfig ) => {
  const { fn, inputDir, readFile, outputDir, debug, dryRun, markerFn, newFileNameFn = (f => f) } = config
  return async ( file: string ) => {
    const metrics: TranformFilesMetric = { readCount: 0, writeCount: 0, failed: [], markerErrors: [] }
    try {
      const content: string = await readFile ( file );
      const marker = await findMarker ( config, metrics, file )
      if ( debug || dryRun ) console.log ( 'file', file, 'marker', marker )
      const newContent = await fn ( content, marker,
        index => inputToOutputFileName ( inputDir, outputDir, config ) ( file, index ) );
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

export const transformFilesIfShaChanged = ( config: TransformDirectoryIfShaChangedConfig ) => {
  const { fn, digest, getShaFromOutput, ...rest } = config
  const newFn: TransformOneFileFn = async ( content: string, marker: string | undefined, filenameFn ) => {
    const thisSha = await digest?. ( content )
    if ( marker === thisSha ) return []
    return fn ( content, thisSha, filenameFn )
  }
  return transformFiles ( { ...rest, fn: newFn } )
};

export type DigestBuffer = ( s: Buffer ) => Promise<string>
export const sha256FromBuffer: DigestBuffer = async ( s: Buffer ): Promise<string> => {
  const hashSum = createHash ( 'sha256' );
  hashSum.update ( s );
  return hashSum.digest ( 'base64url' );
}
export type Digest = ( s: string ) => Promise<string>

export const calculateSHA256: Digest = async ( s: string ): Promise<string> => {
  const hashSum = createHash ( 'sha256' );
  hashSum.update ( s );
  return hashSum.digest ( 'base64url' );
};
