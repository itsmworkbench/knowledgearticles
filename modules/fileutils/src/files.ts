import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

async function* getChildDirectories ( dir: string, filterFn: ( name: string ) => boolean ) {
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
  yield* await getChildDirectories ( dir, filterFn );
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
export type TranformFiles = ( inputDir: string, outputDir: string ) => Promise<TranformFilesMetric>

export const inputToOutputFileName = ( inputDir: string, outputDir: string, config?: TransformFilesConfig ) => ( file: string ) => {
  const { newFileNameFn = f => f } = config || {}
  const relativePath = path.relative ( inputDir, newFileNameFn ( file ) );
  const outputFilePath = path.join ( outputDir, relativePath );
  return outputFilePath;
};
export const transformFiles = ( fn: ( s: string, oldOutput: string | undefined ) => Promise<string | undefined>, config: TransformFilesConfig = {} ): TranformFiles => {
  const { filter, includeOutput, debug, dryRun, newFileNameFn = (f => f) } = config
  return async ( inputDir: string, outputDir: string ) => {
    const inToOut = inputToOutputFileName ( inputDir, outputDir, config )
    let readCount = 0
    let writeCount = 0
    let failed: string[] = []
    for await ( const file of getFilesRecursively ( inputDir, filter ) ) {
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
          writeCount++;
        }
        readCount++;
      } catch ( e ) {
        console.error ( `Failed`, file, e )
        failed.push ( file )
      }
    }
    return { readCount, writeCount, failed }
  };
};


export type TransformShaConfig = {
  digest?: Digest
  getShaFromOutput: ( s: string ) => Promise<string>

}
export const transformIfShaChanged = ( fn: ( inp: string, sha: string, oldOutput: string | undefined ) => Promise<string | undefined>, config: TransformShaConfig ) => {
  const { digest = calculateSHA256, getShaFromOutput } = config;
  return async ( s: string, oldOutput: string | undefined ): Promise<string | undefined> => {
    const sha = await getShaFromOutput ( oldOutput );
    const oldSha: string | undefined = oldOutput && sha;
    return await digest ( s ) === oldSha ? undefined : fn ( s, sha, oldOutput )
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
