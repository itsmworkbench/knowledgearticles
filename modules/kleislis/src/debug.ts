import { LogConfig0, LogFn, makeObjectFromParams, makeObjectFromParamsAndOutput } from "./log";

import { simpleTemplate } from "@itsmworkbench/utils";
import { K0, K1, K2, K3, K4, K5 } from "./kleisli";


export function withDebug<T> ( config: LogConfig0<T> & { id: string }, log: LogFn, fn: K0<T> ): K0<T>;
export function withDebug<P1, T> ( config: LogConfig0<T> & { id: string }, log: LogFn, fn: K1<P1, T> ): K1<P1, T>;
export function withDebug<P1, P2, T> ( config: LogConfig0<T> & { id: string }, log: LogFn, fn: K2<P1, P2, T> ): K2<P1, P2, T>;
export function withDebug<P1, P2, P3, T> ( config: LogConfig0<T> & { id: string }, log: LogFn, fn: K3<P1, P2, P3, T> ): K3<P1, P2, P3, T>;
export function withDebug<P1, P2, P3, P4, T> ( config: LogConfig0<T> & { id: string }, log: LogFn, fn: K4<P1, P2, P3, P4, T> ): K4<P1, P2, P3, P4, T>;
export function withDebug<P1, P2, P3, P4, P5, T> ( config: LogConfig0<T> & { id: string }, log: LogFn, fn: K5<P1, P2, P3, P4, P5, T> ): K5<P1, P2, P3, P4, P5, T>;
export function withDebug<T> ( config: LogConfig0<T> & { id: string }, log: LogFn, fn: ( ...args: any[] ) => Promise<T> ): ( ...args: any ) => Promise<T> {
  return async ( ...args: any[] ) => {
    let { enterMessage, exitMessage, id, loglevel } = config
    if ( loglevel === undefined && enterMessage === undefined && exitMessage === undefined ) return fn ( ...args )
    if ( enterMessage === undefined ) enterMessage = 'Entering {id} with {in}'
    if ( exitMessage === undefined ) exitMessage = 'Exiting {id} with {out}'

    if ( enterMessage ) log ( loglevel || 'TRACE', simpleTemplate ( enterMessage, { id, ...makeObjectFromParams ( config, enterMessage, args ) } ) )
    let result = await fn ( ...args );
    if ( exitMessage ) log ( loglevel || 'DEBUG', simpleTemplate ( exitMessage, { id, ...makeObjectFromParamsAndOutput ( config, exitMessage, args, result ) } ) )
    return result;
  };
}