import { chainOfResponsibility, PartialFunction } from "@itsmworkbench/utils";
import { IncMetric } from "./metrics";

export interface ReplayEvent {
  id: string
}

export type  UpdateReplayEventHistoryFn = ( e: any ) => Promise<void> //really want this to be a replayevent, but the damage this does to the type system is enormous. It propogates into the activites and workflows... and most users will go WTF
export interface ReplayEngine {
  incMetric?: IncMetric
  currentReplayIndex?: number
  replayState?: ReplayEvent[]
  updateEventHistory?: UpdateReplayEventHistoryFn
}
export type ParamsEvent = {
  id: string
  params: any[]
}

export function isParamsEvent ( item: any ): item is ParamsEvent {
  return (item as ParamsEvent).params !== undefined
}

export type SucessfulEvent = {
  id: string
  success: any
}
export function isSucessfulEvent<T> ( item: any ): item is SucessfulEvent {
  return (item as SucessfulEvent).success !== undefined
}
export type FailedEvent = {
  id: string
  failure: any
}
export function isFailedEvent ( item: ReplayEvent ): item is FailedEvent {
  return (item as FailedEvent).failure !== undefined
}

export type BasicReplayEvent = SucessfulEvent | FailedEvent | ParamsEvent
export type BasicReplayEvents = BasicReplayEvent[]


export type  ReplayEventProcessor = <T, E extends ReplayEvent>( activityId: string, e: E ) => Promise<T> // might also throw the previous exception
export type ReplayEventProcessorFn = ( incMetrics: IncMetric ) => ReplayEventProcessor
export type ReplayConfig = {
  shouldRecordResult?: boolean
  eventProcessor: ReplayEventProcessorFn
}
export function processSuccessfulEvent<T> ( incMetric?: IncMetric ): PartialFunction<ReplayEvent, Promise<T>> {
  return {
    isDefinedAt: isSucessfulEvent,
    apply: async ( e: SucessfulEvent ): Promise<T> => {
      if ( incMetric ) incMetric ( 'activity.replay.success' )
      return e.success
    }
  }
}
function enhanceErrorWithOriginalProperties ( originalError: any ) {
  const newError = new Error ( originalError.message );
  newError.name = originalError.name;

  // Copy all enumerable properties from the original error to the new error
  Object.keys ( originalError ).forEach ( key => {
    newError[ key ] = originalError[ key ];
  } );

  return newError;

}
export function processFailedEvent<T> ( incMetric?: IncMetric ): PartialFunction<ReplayEvent, Promise<T>> {
  return {
    isDefinedAt: isFailedEvent,
    apply: async ( e: FailedEvent ): Promise<T> => {
      if ( incMetric ) incMetric ( 'activity.replay.success' )
      throw enhanceErrorWithOriginalProperties ( e.failure )
    }
  }
}
export function processParamsEvent<T> ( incMetric?: IncMetric ): PartialFunction<ReplayEvent, Promise<T>> {
  return {
    isDefinedAt: isParamsEvent,
    apply: async ( e: ParamsEvent ): Promise<T> => {
      if ( incMetric ) incMetric ( 'activity.replay.invalidParamsEvent' )
      throw new Error ( `Invalid params event. These should only occur at 'zero' and already have been processed: ${JSON.stringify ( e )}` )
    }
  }
}
export function processInvalidEvent<T> ( incMetric?: IncMetric ): PartialFunction<ReplayEvent, Promise<T>> {
  return {
    isDefinedAt: ( e: ReplayEvent ) => true,
    apply: async ( e: ReplayEvent ): Promise<T> => {
      if ( incMetric ) incMetric ( 'activity.replay.invalid' )
      throw new Error ( `Invalid replay item: ${JSON.stringify ( e )}` )
    }
  }
}
export function invalid<T> ( incMetric?: IncMetric ): ( e: any ) => Promise<T> {
  return async ( e: any ): Promise<T> => {
    if ( incMetric ) incMetric ( 'activity.replay.invalid' )
    throw new Error ( `Invalid replay item: ${JSON.stringify ( e )}` );
  }
}

export function validateActivityId<E extends { id: string }> ( e: E, activityId: string, incMetric: ( metricName: string ) => void ) {
  if ( e.id !== activityId ) {
    if ( incMetric ) incMetric ( 'activity.replay.invalidid' )
    throw new Error ( `Invalid replay item. It should have had id ${activityId} and had ${(e as any).id}: ${JSON.stringify ( e )}` );
  }
}
export const replyEventProcessor: ReplayEventProcessorFn = incMetric => {
  const chain = chainOfResponsibility ( invalid ( incMetric ),
    processSuccessfulEvent ( incMetric ),
    processFailedEvent ( incMetric ),
    processParamsEvent ( incMetric ),
    processInvalidEvent ( incMetric )
  );
  return ( activityId, e ): Promise<any> => {
    validateActivityId ( e, activityId, incMetric );
    return chain ( e )
  }
};