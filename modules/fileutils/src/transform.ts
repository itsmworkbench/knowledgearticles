export type Transform<T> = ( s: T ) => T | undefined
export type TransformK<T> = ( s: T ) => Promise<T | undefined>

export const liftK = <T> ( t: Transform<T> ): TransformK<T> =>
  async ( s: T ) => t ( s );

export function asJsonT ( jt: Transform<any> ): Transform<string> {
  return ( s: string ) => {
    try {
      return JSON.stringify ( jt ( JSON.parse ( s ) ) )
    } catch ( e ) {
      console.error ( e )
      return undefined
    }
  }
}
