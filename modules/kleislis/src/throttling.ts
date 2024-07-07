import { K0, K1, K2, K3, K4, K5 } from "./kleisli";

export type Throttling = {
  current?: number;
  kill?: boolean;
  max: number;
  throttlingDelay?: number;    // Max random delay before retrying in ms defaults 50ms
  tokensPer100ms?: number; //defaults to 0.1
  intervalId?: NodeJS.Timeout;  // Store the interval ID here
  countOnTooManyErrors?: number; // if we get a 429 too many requests error, we set the current to this value. Default is -500. If the tokensPre100ms is 0.1,This will take 50 seconds before we try again
};

export function withThrottle<T> ( throttle: Throttling, fn: K0<T> ): K0<T>;
export function withThrottle<P1, T> ( throttle: Throttling, fn: K1<P1, T> ): K1<P1, T>;
export function withThrottle<P1, P2, T> ( throttle: Throttling, fn: K2<P1, P2, T> ): K2<P1, P2, T>;
export function withThrottle<P1, P2, P3, T> ( throttle: Throttling, fn: K3<P1, P2, P3, T> ): K3<P1, P2, P3, T>;
export function withThrottle<P1, P2, P3, P4, T> ( throttle: Throttling, fn: K4<P1, P2, P3, P4, T> ): K4<P1, P2, P3, P4, T>;
export function withThrottle<P1, P2, P3, P4, P5, T> ( throttle: Throttling, fn: K5<P1, P2, P3, P4, P5, T> ): K5<P1, P2, P3, P4, P5, T>;

export function withThrottle<T> ( throttle: Throttling, fn: ( ...args: any[] ) => Promise<T> ): ( ...args: any ) => Promise<T> {
  return async ( ...args: any[] ) => {
    const attemptInvoke = async (): Promise<T> => {
      const { current = 0, max, throttlingDelay = 50 } = throttle;
      if ( current > 0 ) {
        throttle.current = current - 1;
        try {
          // console.log('executing in throttle', throttle.current, throttle.tokensPer100ms)
          return await fn ( ...args );
        } catch ( e: any ) {
          if ( e.message === 'Too many requests' ) {
            if ( throttle.current > -10 ) {
              throttle.tokensPer100ms = (throttle.tokensPer100ms || 1) * .9
              console.log ( 'Too many requests - throttling back', throttle.tokensPer100ms )
            }
            throttle.current = (throttle.countOnTooManyErrors || -10)
          }
          throw e // hopefully the retry logic will kick in
        }
      } else {
        const delay = Math.random () * throttlingDelay;
        await new Promise ( resolve => setTimeout ( resolve, delay ) );
        return attemptInvoke ();  // Retry the invocation
      }
    };
    startThrottling ( throttle )
    return attemptInvoke ();
  };
}

export function startThrottling ( throttle: Throttling ) {
  if ( throttle.intervalId || throttle.kill ) return;  // Idempotently handle already running intervals
  throttle.intervalId = setInterval ( () => {
    const { current = 0, max, tokensPer100ms = 0.1 } = throttle;
    throttle.current = Math.min ( max, current + tokensPer100ms );
  }, 100 );
}

export function stopThrottling ( throttle: Throttling ) {
  if ( throttle.intervalId ) {
    clearInterval ( throttle.intervalId );
    throttle.kill = true
    throttle.intervalId = undefined;  // Clear the intervalId after stopping the loop
  }
}
