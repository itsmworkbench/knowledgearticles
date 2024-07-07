import { K0, K1, K2, K3, K4, K5, Kleisli } from "./kleisli";
import { IncMetric, nullIncMetric } from "./metrics";


export type RetryPolicyConfig = {
  initialInterval: number; // In milliseconds
  maximumInterval: number; // In milliseconds
  maximumAttempts: number;
  multiplier?: number//default 2. For exponential backoff
  nonRecoverableErrors?: string[];
};
export const defaultRetryPolicy: RetryPolicyConfig = {
  initialInterval: 1000,
  maximumInterval: 30000,
  maximumAttempts: 3,
  nonRecoverableErrors: [ 'Not Found' ]
}
export const noRetryPolicy: RetryPolicyConfig = {
  initialInterval: 1000,
  maximumInterval: 30000,
  maximumAttempts: 1,
  nonRecoverableErrors: [ 'Not Found' ]
}

export function withRetry<T> ( retryPolicy: RetryPolicyConfig| undefined, fn: K0<T> ): K0<T>;
export function withRetry<P1, T> ( retryPolicy: RetryPolicyConfig| undefined, fn: K1<P1, T> ): K1<P1, T>;
export function withRetry<P1, P2, T> ( retryPolicy: RetryPolicyConfig| undefined, fn: K2<P1, P2, T> ): K2<P1, P2, T>;
export function withRetry<P1, P2, P3, T> ( retryPolicy: RetryPolicyConfig| undefined, fn: K3<P1, P2, P3, T> ): K3<P1, P2, P3, T>;
export function withRetry<P1, P2, P3, P4, T> ( retryPolicy: RetryPolicyConfig| undefined, fn: K4<P1, P2, P3, P4, T> ): K4<P1, P2, P3, P4, T>;
export function withRetry<P1, P2, P3, P4, P5, T> ( retryPolicy: RetryPolicyConfig| undefined, fn: K5<P1, P2, P3, P4, P5, T> ): K5<P1, P2, P3, P4, P5, T>;

export function withRetry<T> ( retryPolicy: RetryPolicyConfig | undefined, fn: ( ...args: any[] ) => Promise<T> ): Kleisli<T> {
  return withMeteredRetry ( retryPolicy, nullIncMetric, fn );
}

export function withMeteredRetry<T> ( retryPolicy: RetryPolicyConfig| undefined, incMetric: IncMetric, fn: K0<T> ): K0<T>;
export function withMeteredRetry<P1, T> ( retryPolicy: RetryPolicyConfig| undefined, incMetric: IncMetric, fn: K1<P1, T> ): K1<P1, T>;
export function withMeteredRetry<P1, P2, T> ( retryPolicy: RetryPolicyConfig| undefined, incMetric: IncMetric, fn: K2<P1, P2, T> ): K2<P1, P2, T>;
export function withMeteredRetry<P1, P2, P3, T> ( retryPolicy: RetryPolicyConfig| undefined, incMetric: IncMetric, fn: K3<P1, P2, P3, T> ): K3<P1, P2, P3, T>;
export function withMeteredRetry<P1, P2, P3, P4, T> ( retryPolicy: RetryPolicyConfig| undefined, incMetric: IncMetric, fn: K4<P1, P2, P3, P4, T> ): K4<P1, P2, P3, P4, T>;
export function withMeteredRetry<P1, P2, P3, P4, P5, T> ( retryPolicy: RetryPolicyConfig| undefined, incMetric: IncMetric, fn: K5<P1, P2, P3, P4, P5, T> ): K5<P1, P2, P3, P4, P5, T>;

export function withMeteredRetry<T> ( retryPolicy: RetryPolicyConfig | undefined, incMetric: IncMetric, fn: ( ...args: any[] ) => Promise<T> ): Kleisli<T> {
  if ( retryPolicy === undefined ) retryPolicy = defaultRetryPolicy
  const multiplier = retryPolicy.multiplier || 2;
  const nonRecoverableErrors = retryPolicy.nonRecoverableErrors || [];
  return async ( ...args: any ): Promise<T> => {
    let attempts = 0;
    let delay = retryPolicy.initialInterval;
    const attemptExecution = async (): Promise<T> => {
      try {
        incMetric ( 'activity.attempts' );
        if ( attempts > 0 ) console.log ( 'attempts', attempts, retryPolicy.maximumAttempts, delay )
        let result = await fn ( ...args );
        incMetric ( 'activity.success' );
        return result;
      } catch ( error: any ) {
        console.log ( 'error', error.message, 'attempts', attempts, retryPolicy.maximumAttempts, 'retryPolicy.maximumAttempts', retryPolicy.maximumAttempts, 'delay', delay, 'multiplier', multiplier, 'retryPolicy.maximumInterval', retryPolicy.maximumInterval, 'nonRecoverableErrors', nonRecoverableErrors )
        if ( nonRecoverableErrors.includes ( error.message ) ) {
          incMetric ( 'activity.non_recoverable_error' );
          return Promise.reject ( error );
        }  // Rethrow if non-recoverable
        if ( ++attempts < retryPolicy.maximumAttempts ) {
          // Calculate next delay
          delay = Math.min ( delay * multiplier, retryPolicy.maximumInterval );
          await new Promise ( resolve => setTimeout ( resolve, delay ) );
          incMetric ( 'activity.retry[' + attempts + ']' )
          return attemptExecution (); // Retry recursively
        } else {
          incMetric ( 'activity.error_max_attempts' );
          throw error;  // Rethrow after max attempts
        }
      }
    };
    return attemptExecution ();
  };
}
