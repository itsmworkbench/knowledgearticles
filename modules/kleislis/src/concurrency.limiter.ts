// Define a generic function type that takes an input and returns a promise with an output
import { K0, K1, K2, K3, K4, K5 } from "./kleisli";


// Type for tasks in the concurrency limiter's queue
export type Task<TOutput> = {
  fn: K0<TOutput>;
  resolve: ( output: TOutput ) => void;
  reject: ( err: any ) => void;
};

export function withConcurrencyLimit<T> ( limit: number, queue: Task<any>[], fn: K0<T> ): K0<T>;
export function withConcurrencyLimit<P1, T> ( limit: number, queue: Task<any>[], fn: K1<P1, T> ): K1<P1, T>;
export function withConcurrencyLimit<P1, P2, T> ( limit: number, queue: Task<any>[], fn: K2<P1, P2, T> ): K2<P1, P2, T>;
export function withConcurrencyLimit<P1, P2, P3, T> ( limit: number, queue: Task<any>[], fn: K3<P1, P2, P3, T> ): K3<P1, P2, P3, T>;
export function withConcurrencyLimit<P1, P2, P3, P4, T> ( limit: number, queue: Task<any>[], fn: K4<P1, P2, P3, P4, T> ): K4<P1, P2, P3, P4, T>;
export function withConcurrencyLimit<P1, P2, P3, P4, P5, T> ( limit: number, queue: Task<any>[], fn: K5<P1, P2, P3, P4, P5, T> ): K5<P1, P2, P3, P4, P5, T>;


export function withConcurrencyLimit<TInput, TOutput> ( limit: number, queue: Task<any>[], fn: ( ...args: any[] ) =>  Promise<TOutput> ): (( ...args: any[] ) => Promise<TOutput>) {
  let active = 0;

  const next = () => {
    if ( queue.length > 0 && active < limit ) {
      active++;
      const { fn, resolve, reject } = queue.shift ()!;
      fn ().then ( resolve ).catch ( reject ).finally ( () => {
        active--;
        next ();
      } );
    }
  };

  return async ( ...args: any[] ) => new Promise<TOutput> ( ( resolve, reject ) => {
    const task: Task<TOutput> = { fn: () =>
        fn ( ...args ), resolve, reject };
    queue.push ( task );
    next ();
  } );
}
