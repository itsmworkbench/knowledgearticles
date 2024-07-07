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

export type TransformFilesConfig = {
  filter?: ( file: string ) => boolean
  includeOutput?: boolean
  newFileNameFn?: ( file: string ) => string
  dryRun?: boolean
  debug?: boolean
}

export const changeExtension = ( newExt: string ) => ( s: string, ) => s.replace ( /\.[^/.]+$/, newExt );

export type TranformFilesMetric = {
  readCount: number
  writeCount: number
  failed: string[]
}
export function addMetrics ( metrics: TranformFilesMetric[] ): TranformFilesMetric {
  return metrics.reduce ( ( acc, m ) => ({
    readCount: acc.readCount + m.readCount,
    writeCount: acc.writeCount + m.writeCount,
    failed: [ ...acc.failed, ...m.failed ]
  }), { readCount: 0, writeCount: 0, failed: [] } )
}
export type TranformFiles = ( inputDir: string, outputDir: string ) => Promise<TranformFilesMetric>

export const inputToOutputFileName = ( inputDir: string, outputDir: string, config?: TransformFilesConfig ) => ( file: string ) => {
  const { newFileNameFn = ( f: string ) => f } = config || {}
  const relativePath = path.relative ( inputDir, newFileNameFn ( file ) );
  const outputFilePath = path.join ( outputDir, relativePath );
  return outputFilePath;
};


const transformOneFile = ( fn: ( s: string, oldOutput: string | undefined ) => Promise<string | undefined>, inputDir: string, outputDir: string, config: TransformFilesConfig ) => async ( file: string ) => {
  const { filter, includeOutput, debug, dryRun, newFileNameFn = (f => f) } = config
  const metrics: TranformFilesMetric = { readCount: 0, writeCount: 0, failed: [] }
  const inToOut = inputToOutputFileName ( inputDir, outputDir, config )
  try {
    const content: string = await fs.readFile ( file, 'utf-8' );
    const outputFilePath = inToOut ( file );
    const oldOutput = includeOutput ? await fs.readFile ( outputFilePath, 'utf-8' ).catch ( () => undefined ) : undefined;
    if ( debug || dryRun ) console.log ( 'file', file, '=>', outputFilePath, 'oldExists', oldOutput !== undefined )
    const newContent = await fn ( content, oldOutput );

    if ( newContent && !dryRun ) {
      const newDir = path.dirname ( outputFilePath );
      await fs.mkdir ( newDir, { recursive: true } );
      await fs.writeFile ( outputFilePath, newContent );
      metrics.writeCount++;
    }
    metrics.readCount++;
  } catch ( e ) {
    console.error ( `Failed`, file, e )
    metrics.failed.push ( file )
  }
  return metrics
};
export const transformFiles = ( fn: ( s: string, oldOutput: string | undefined ) => Promise<string | undefined>, config: TransformFilesConfig = {} ): TranformFiles => {
  const { filter } = config
  return async ( inputDir: string, outputDir: string ) => {
    const metrics = await mapAsyncG ( getFilesRecursively ( inputDir, filter ), transformOneFile ( fn, inputDir, outputDir, config ) )
    return addMetrics ( metrics )
  };
};


export type TransformShaConfig = {
  digest?: Digest
  getShaFromOutput: ( s: string ) => Promise<string | undefined>

}
export const transformIfShaChanged = ( fn: ( inp: string, sha: string, oldOutput: string | undefined ) => Promise<string | undefined>, config: TransformShaConfig ) => {
  const { digest = calculateSHA256, getShaFromOutput } = config;
  return async ( s: string, oldOutput: string | undefined ): Promise<string | undefined> => {
    const sha: string = await digest ( s )
    const oldSha: string | undefined = oldOutput && await getShaFromOutput ( oldOutput );
    return sha === oldSha ? undefined : fn ( s, sha, oldOutput )
  };
};

export type TransformDirectoryIfShaChangedConfig = TransformFilesConfig & TransformShaConfig

export const transformFilesIfShaChanged = ( fn: ( inp: string, sha: string, oldOutput: string | undefined ) => Promise<string | undefined>, config: TransformDirectoryIfShaChangedConfig ): TranformFiles => {
  const { digest, getShaFromOutput, ...rest } = config
  return transformFiles ( transformIfShaChanged ( fn, config ), { ...rest, includeOutput: true } )
};

export type Digest = ( s: string ) => Promise<string>

export const calculateSHA256: Digest = async ( s: string ): Promise<string> => {
  const hashSum = createHash ( 'sha256' );
  hashSum.update ( s );
  return hashSum.digest ( 'base64url' );
};
