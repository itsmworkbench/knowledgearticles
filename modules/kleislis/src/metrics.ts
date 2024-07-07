import { NameAnd } from "@laoban/utils";
import { K0, K1, K2, K3, K4, K5 } from "./kleisli";
import { Sideeffect } from "./sideeffect";

export type IncMetric = ( metricName: string ) => void

export function inMemoryIncMetric ( metrics: NameAnd<number> ): IncMetric {
  return ( metricName: string ) => {
    if ( metrics[ metricName ] === undefined ) metrics[ metricName ] = 0
    metrics[ metricName ]++
  }
}
export const nullIncMetric: IncMetric = () => {}

export function withWriteMetrics<T> ( writeMetrics: Sideeffect, fn: K0<T> ): K0<T>;
export function withWriteMetrics<P1, T> ( writeMetrics: Sideeffect, fn: K1<P1, T> ): K1<P1, T>;
export function withWriteMetrics<P1, P2, T> ( writeMetrics: Sideeffect, fn: K2<P1, P2, T> ): K2<P1, P2, T>;
export function withWriteMetrics<P1, P2, P3, T> ( writeMetrics: Sideeffect, fn: K3<P1, P2, P3, T> ): K3<P1, P2, P3, T>;
export function withWriteMetrics<P1, P2, P3, P4, T> ( writeMetrics: Sideeffect, fn: K4<P1, P2, P3, P4, T> ): K4<P1, P2, P3, P4, T>;
export function withWriteMetrics<P1, P2, P3, P4, P5, T> ( writeMetrics: Sideeffect, fn: K5<P1, P2, P3, P4, P5, T> ): K5<P1, P2, P3, P4, P5, T>;
export function withWriteMetrics<T> ( writeMetrics: Sideeffect, fn: ( ...args: any[] ) => Promise<T> ): ( ...args: any ) => Promise<T> {
  return async ( ...args: any[] ) => {
    try {
      return await fn ( ...args )
    } finally {
      if ( writeMetrics )
        await writeMetrics?. ()
    }
  }
}
