
export type Sideeffect = () => Promise<void>
export function withSideeffectAtEnd<T> ( sideeffect: Sideeffect | undefined, fn: ( ...args: any[] ) => Promise<T> ): ( ...args: any ) => Promise<T> {
  if ( sideeffect === undefined ) return fn
  return async ( ...args: any[] ) => {
    try {
      return await fn ( ...args )
    } finally {
      await sideeffect ()
    }
  }
}