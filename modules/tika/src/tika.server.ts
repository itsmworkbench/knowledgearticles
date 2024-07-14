import { ChildProcess, spawn } from "node:child_process";
import treeKill from "tree-kill";
import * as net from "node:net";

export type TikaServer = {
  jar: string;
  process: ChildProcess | null;
  port: number;
  debug?: boolean;
};
export function checkPortAvailability ( port: number ): Promise<void> {
  return new Promise ( ( resolve, reject ) => {
    const server = net.createServer ();

    server.once ( 'error', ( err: any ) => {
      if ( err.code === 'EADDRINUSE' ) {
        reject ( new Error ( `Port ${port} is already in use` ) );
      } else {
        reject ( err );
      }
    } );

    server.once ( 'listening', () => {
      server.close ();
      resolve ();
    } );

    server.listen ( port );
  } );
}

export async function startServer ( server: TikaServer ): Promise<void> {
  const debug = server.debug === true;
  await checkPortAvailability ( server.port )
  let started = false;
  return new Promise ( ( resolve, reject ) => {
    server.process = spawn ( 'java', [ '-jar', server.jar, '-p', server.port.toString () ], {
      stdio: [ 'pipe', 'pipe', 'pipe' ]
    } );

    const handleData = ( data: Buffer, isErrorStream: boolean ) => {
      const message = data.toString ();
      if ( debug ) console.log ( `[Tika Server ${isErrorStream ? 'Error' : 'Log'}] ${message}` );
      if ( !started && message.includes ( 'Started' ) ) {
        started = true;
        resolve ();
      }
      if ( !started && message.includes ( 'Error' ) ) reject ( new Error ( message ) );
    };

    if ( server.process ) {
      server.process.stdout.on ( 'data', ( data ) => handleData ( data, false ) );
      server.process.stderr.on ( 'data', ( data ) => handleData ( data, true ) );

      server.process.on ( 'close', ( code ) => {
        if ( debug ) {
          console.log ( `[Tika Server] Process exited with code ${code}` );
        }
      } );
    } else {
      reject ( new Error ( 'Failed to start Tika server process' ) );
    }
  } );
}
export function stopServer ( server: TikaServer ): Promise<void> {
  return new Promise ( ( resolve ) => {
    if ( server.process ) {
      const forceKillTimeout = setTimeout ( () => {
        treeKill ( server.process!.pid, 'SIGKILL', () => {
          if ( server.debug ) {
            console.log ( `[Tika Server] Process forcefully killed` );
          }
          resolve ();
        } );
      }, 5000 ); // Wait 5 seconds before forcefully killing the process

      server.process.on ( 'exit', () => {
        clearTimeout ( forceKillTimeout ); // Clear the timeout to prevent force killing
        if ( server.debug ) {
          console.log ( `[Tika Server] Process exited` );
        }
        resolve ();
      } );

      treeKill ( server.process.pid, 'SIGTERM' ); // Attempt to gracefully shut down the process
    } else {
      resolve ();
    }
  } );
}
