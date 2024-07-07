import { ErrorsAnd, hasErrors } from "@laoban/utils";
import { getDirectoriesRecursively } from "./files";
import cp from "child_process";

export interface SuccessfulShellResult {
  message: string
  code: 0
}
export function isSuccessfulShellResult ( t: ShellResult ): t is SuccessfulShellResult {
  return t.code === 0
}
export interface FailedShellResult {
  message?: string
  error: string
  code: number
}
export type ShellResult = SuccessfulShellResult | FailedShellResult

export type ExecuteConfig = {
  encoding?: BufferEncoding
  dryRun?: boolean
  debug?: boolean
}
export type ExecuteConfigWithShell = ExecuteConfig & {
  executeInShell?: ExecuteInShellFn
}


export type ExecuteInShellFn = ( cwd: string, cmd: string, config: ExecuteConfig ) => Promise<ShellResult>;

export const executeScriptInShell: ExecuteInShellFn = ( cwd: string, cmd: string, config: ExecuteConfig ): Promise<ShellResult> => {
  let { encoding = 'utf8', debug } = config
  if ( debug ) console.log ( 'executeScriptInShell', cwd, cmd.trim () )
  return new Promise<ShellResult> ( resolve => {
    cp.exec ( cmd, { cwd, env: process.env, encoding }, ( error, stdout, stdErr ) => {
      if ( debug ) console.log ( 'exec - error ', error )
      if ( debug ) console.log ( 'exec - stdout', stdout )
      if ( debug ) console.log ( 'exec - strError', stdErr )
      if ( stdErr === '' && (error === null || error.code === 0) )
        resolve ( { message: stdout.toString (), code: 0 } )
      else
        resolve ( { message: stdout.toString (), error: stdErr.toString (), code: error?.code || 0 } )
    } )
  } );
};

export async function execute ( cwd: string, cmd: string, config: ExecuteConfigWithShell = {} ): Promise<ErrorsAnd<string>> {
  const { encoding, executeInShell = executeScriptInShell, debug, dryRun } = config
  if ( debug || dryRun ) console.log ( 'execute ', cwd, cmd )
  if ( dryRun ) return []
  const res = await executeInShell ( cwd, cmd, config )
  if ( isSuccessfulShellResult ( res ) ) return res.message
  return [ res.error ]
}


export async function executeRecursivelyInChildDirectories ( cwd: string, cmds: string, config?: ExecuteConfigWithShell ) {
  let executed = 0
  let failed: string[] = []
  for await ( const dir of getDirectoriesRecursively ( cwd ) ) {
    try {
      await execute ( dir, cmds, config )
      executed++
    } catch ( e: any ) {
      failed.push ( dir )
    }
    return { executed, failed }
  }
}

export async function executeRecursivelyCmdChanges ( cwd: string, startDir: string, cmdFn: ( dir: string ) => string, config?: ExecuteConfigWithShell ) {
  let executed = 0
  let failed: string[] = []
  for await ( const dir of getDirectoriesRecursively ( startDir ) ) {
    try {
      const result = await execute ( cwd, cmdFn ( dir ), config )
      if ( hasErrors ( result ) && result.length > 0 ) {
        failed.push ( dir + ' ' + result.join ( ';' ) )
        console.error ( result )
      }
      executed++
    } catch ( e: any ) {
      failed.push ( dir )
    }
  }
  return { executed, failed }
}

