
import { ReplayConfig, ReplayEngine, ReplayEvent } from "./replay.events";
import { InjectedK0, InjectedK1, InjectedK2, InjectedK3, InjectedK4, InjectedK5, K0, K1, K2, K3, K4, K5 } from "./kleisli";


export function withReplay<T> ( activityId: string, config: ReplayConfig, fn: K0<T> ): InjectedK0<ReplayEngine, T>
export function withReplay<P1, T> ( activityId: string, config: ReplayConfig, fn: K1<P1, T> ): InjectedK1<ReplayEngine, P1, T>
export function withReplay<P1, P2, T> ( activityId: string, config: ReplayConfig, fn: K2<P1, P2, T> ): InjectedK2<ReplayEngine, P1, P2, T>
export function withReplay<P1, P2, P3, T> ( activityId: string, config: ReplayConfig, fn: K3<P1, P2, P3, T> ): InjectedK3<ReplayEngine, P1, P2, P3, T>
export function withReplay<P1, P2, P3, P4, T> ( activityId: string, config: ReplayConfig, fn: K4<P1, P2, P3, P4, T> ): InjectedK4<ReplayEngine, P1, P2, P3, P4, T>
export function withReplay<P1, P2, P3, P4, P5, T> ( activityId: string, config: ReplayConfig, fn: K5<P1, P2, P3, P4, P5, T> ): InjectedK5<ReplayEngine, P1, P2, P3, P4, P5, T>
export function withReplay<T, Args extends any[]> (
  activityId: string,
  config: ReplayConfig,
  fn: ( ...args: Args ) => Promise<T> ): ( e: ReplayEngine ) => ( ...args: Args ) => Promise<T> {
  if (typeof config.eventProcessor !== 'function')
    throw new Error('eventProcessor is required')

  return engine => async ( ...args: Args ): Promise<T> => {
    let { currentReplayIndex, replayState, updateEventHistory, incMetric } = engine
    if ( replayState === undefined ) replayState = []
    if ( currentReplayIndex === undefined ) currentReplayIndex = 0

    const eventProcessor = config.eventProcessor ( incMetric )
    if ( eventProcessor === undefined ) throw new Error ( 'eventProcessor is required' )

    // Retrieve the current replay item if it exists
    const replayItem = replayState[ currentReplayIndex ];

    // Move to the next index
    engine.currentReplayIndex = currentReplayIndex + 1;
    // Check if we can use a cached result
    if ( replayItem ) return eventProcessor ( activityId, replayItem );

// Execute the function and update the cache if no valid cache item was found
    try {
      const result = await fn ( ...args );
      if ( config.shouldRecordResult !==false ) await updateEventHistory ( { id: activityId, success: result } );
      return result;
    } catch ( failure ) {
      if ( config.shouldRecordResult !==false) await updateEventHistory ( { id: activityId, failure } );
      throw failure;
    }
  }
}


export const rememberUpdateCache = <E extends ReplayEvent> ( store: E[] ) => async e => { store.push ( e );}
