import { K0, K1, K2, K3, Kleisli } from "./kleisli";


export function debounce<T extends ( ...args: any[] ) => any> ( func: T, delay: number = 500 ): ( ...args: Parameters<T> ) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout>;

  return function ( ...args: Parameters<T> ): Promise<ReturnType<T>> {
    return new Promise ( ( resolve ) => {
      clearTimeout ( timeoutId );
      timeoutId = setTimeout ( () => {
        resolve ( func ( ...args ) );
      }, delay );
    } );
  };
}

export function debounceK<T> ( k0: K0<T>, delay: number ): K0<T>;
export function debounceK<T1, T> ( k1: K1<T1, T>, delay: number ): K1<T1, T>;
export function debounceK<T1, T2, T> ( k2: K2<T1, T2, T>, delay: number ): K2<T1, T2, T>;
export function debounceK<T1, T2, T3, T> ( k3: K3<T1, T2, T3, T>, delay: number ): K3<T1, T2, T3, T>;
export  function debounceK<T> ( fn: Kleisli<T>, delay: number ): Kleisli<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  return ( ...args: any[] ) => new Promise<T> ( ( resolve, reject ) => {
    clearTimeout ( timeoutId );
    timeoutId = setTimeout ( () => {
      (fn as any) ( ...args ).then ( resolve ).catch ( reject );
    }, delay );
  } )
}


