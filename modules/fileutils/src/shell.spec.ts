import { execute, ExecuteConfig, ExecuteConfigWithShell, executeRecursivelyCmdChanges, executeScriptInShell, FailedShellResult, isSuccessfulShellResult, ShellResult, SuccessfulShellResult } from "./shell";
import * as path from 'path';
import * as os from "node:os";
import { errors, hasErrors } from "@laoban/utils";

describe ( 'isSuccessfulShellResult', () => {
  it ( 'should return true for a successful shell result', () => {
    const result: SuccessfulShellResult = {
      code: 0,
      message: 'Success'
    };

    expect ( isSuccessfulShellResult ( result ) ).toBe ( true );
  } );

  it ( 'should return false for a failed shell result with non-zero code', () => {
    const result: FailedShellResult = {
      code: 1,
      message: 'Failed',
      error: 'Some error'
    };

    expect ( isSuccessfulShellResult ( result ) ).toBe ( false );
  } );
} );

describe ( 'executeScriptInShell', () => {
  const defaultConfig: ExecuteConfig = { encoding: 'utf8', debug: false };
  const currentDir = process.cwd ();
  const parentDir = path.dirname ( currentDir );

  it ( 'should execute "pwd" command in current directory', async () => {
    const cmd = os.platform () === 'win32' ? 'cd' : 'pwd';
    const result = await executeScriptInShell ( currentDir, cmd, defaultConfig );

    expect ( result.code ).toBe ( 0 );
    expect ( result.message.trim () ).toContain ( currentDir );
  } );

  it ( 'should execute "pwd" command in parent directory', async () => {
    const cmd = os.platform () === 'win32' ? 'cd' : 'pwd';
    const result = await executeScriptInShell ( parentDir, cmd, defaultConfig );

    expect ( result.code ).toBe ( 0 );
    expect ( result.message.trim () ).toContain ( parentDir );
    expect ( result.message.trim () ).not.toContain ( currentDir );
  } );

  it ( 'should execute "echo Hello World"', async () => {
    const cmd = 'echo Hello World';
    const result = await executeScriptInShell ( currentDir, cmd, defaultConfig );

    expect ( result.code ).toBe ( 0 );
    expect ( result.message.trim () ).toBe ( 'Hello World' );
  } );

  it ( 'should handle execution errors', async () => {
    const cmd = 'invalidCommand';
    const result: ShellResult = await executeScriptInShell ( currentDir, cmd, defaultConfig );

    expect ( result.code ).not.toBe ( 0 );
    expect ( (result as any).error ).toBeDefined ();
  } );
} );


describe ( 'execute', () => {
  const cwd = process.cwd (); // Use the current working directory
  const cmd = 'echo hello';
  const invalidCmd = 'invalidcommand';
  let originalConsoleLog: any;
  beforeAll ( () => {
    // Save the original console.log method
    originalConsoleLog = console.log;
  } );

  afterAll ( () => {
    // Restore the original console.log method
    console.log = originalConsoleLog;
  } );
  it ( 'should log the command if debug is enabled', async () => {
    console.log = jest.fn ();

    const config: ExecuteConfigWithShell = { debug: true };

    await execute ( cwd, cmd, config );

    expect ( console.log ).toHaveBeenCalledWith ( 'execute ', cwd, cmd );
  } );

  it ( 'should return an empty array if dryRun is enabled', async () => {
    const config: ExecuteConfigWithShell = { dryRun: true };

    const result = await execute ( cwd, cmd, config );

    expect ( result ).toEqual ( [] );
  } );

  it ( 'should return the message if the command is successful', async () => {
    const config: ExecuteConfigWithShell = {};

    const result = await execute ( cwd, cmd, config );
    if ( hasErrors ( result ) ) throw new Error ( result.join ( ';' ) )
    expect ( result.trim () ).toEqual ( 'hello' );
  } );

  it ( 'should return the error if the command fails', async () => {
    const config: ExecuteConfigWithShell = {};

    const result = await execute ( cwd, invalidCmd, config );

    expect ( errors ( result ).join ( ';' ) ).toContain ( 'invalidcommand' ); // Adjust this based on your OS error message
  } );

  it ( 'should use the custom executeInShell function if provided', async () => {
    const customExecuteInShell = jest.fn ().mockResolvedValue ( {
      code: 0,
      message: 'Custom Success',
    } );

    const config: ExecuteConfigWithShell = { executeInShell: customExecuteInShell };

    const result = await execute ( cwd, cmd, config );

    expect ( result ).toEqual ( 'Custom Success' );
    expect ( customExecuteInShell ).toHaveBeenCalledWith ( cwd, cmd, config );
  } );
} );


describe ( 'executeRecursivelyCmdChanges', () => {
  const cwd = process.cwd (); // Use the current working directory
  const startDir = path.join ( cwd, 'test' ); // Assuming 'test' directory exists in the current working directory

  const normalizePath = ( p: string ) => p.replace ( /\\/g, '/' );

  let originalConsoleLog: any;
  let consoleOutput: string[] = [];

  beforeAll ( () => {
    // Save the original console.log method
    originalConsoleLog = console.log;
    console.log = ( message: string ) => {
      consoleOutput.push ( message );
    };
  } );

  afterAll ( () => {
    // Restore the original console.log method
    console.log = originalConsoleLog;
  } );

  beforeEach ( () => {
    consoleOutput = [];
  } );

  //note: really hard to check it actually did this... so just check it ran. However with the next test we're probably ok
  it ( 'should execute commands recursively for success', async () => {
    const result = await executeRecursivelyCmdChanges ( cwd, startDir, ( dir: string ) => `echo ${dir}` );

    const { executed, failed } = result;

    // Ensure some commands were executed
    expect ( executed ).toEqual ( 3 );

    // Expecting no failures
    expect ( failed ).toEqual ( [] );

  } );
  it ( 'should give failures for invalid commands', async () => {
    const result = await executeRecursivelyCmdChanges ( cwd, startDir, ( dir: string ) => `invalidcommand ${dir}` );

    const { executed, failed } = result;

    // Ensure some commands were executed
    expect ( executed ).toEqual ( 3 );

    const clean = failed.map ( normalizePath )
    expect ( clean.length ).toEqual ( 3 )
    expect ( clean[ 0 ] ).toContain ( '/test ' );
    expect ( clean[ 0 ] ).toContain ( 'invalidcommand' );
    expect ( clean[ 1 ] ).toContain ( '/test/a ' );
    expect ( clean[ 1 ] ).toContain ( 'invalidcommand' );
    expect ( clean[ 2 ] ).toContain ( '/test/b ' );
    expect ( clean[ 2 ] ).toContain ( 'invalidcommand' );
  } );
} );
