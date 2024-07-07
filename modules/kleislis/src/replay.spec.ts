import { NameAnd } from "@laoban/utils";
import { inMemoryIncMetric } from "./metrics";
import { BasicReplayEvents, ReplayEngine, replyEventProcessor } from "./replay.events";
import { withReplay } from "./replay";


describe ( 'replay', () => {
  const activityId = 'testActivity';
  let replayState;
  let updateState: BasicReplayEvents // Separate state for updates
  let metrics: NameAnd<number> = {}
  const incMetric = inMemoryIncMetric ( metrics );
  const empty = { workflowId: 'someId', workflowInstanceId: 'anotherId', currentReplayIndex: 0 }
  beforeEach ( () => {
    replayState = []; // Replay state is now an array of ReplayItems
    updateState = []
    for ( const key in metrics ) delete metrics[ key ]
  } );

  const updateEventHistory = async ( e ) => {updateState.push ( e )}


  it ( 'should return a cached success result without executing the function', async () => {
    const fn = jest.fn ( () => Promise.resolve ( 'new data' ) );
    replayState.push ( { id: activityId, success: 'cached data' } ); // Add a successful replay item

    const engine: ReplayEngine = { incMetric, currentReplayIndex: 0, replayState, updateEventHistory }
    const replayFunction = withReplay<string> ( activityId, {eventProcessor:replyEventProcessor}, fn );
    const result = await replayFunction ( engine ) ();

    expect ( result ).toBe ( 'cached data' );
    expect ( fn ).not.toHaveBeenCalled ();
    expect ( updateState ).toEqual ( [] )
    expect ( metrics ).toEqual ( { 'activity.replay.success': 1 } )
  } );

  it ( 'should execute the function and update the update cache if no cached result is available, also creates params event', async () => {
    const fn = jest.fn ( () => Promise.resolve ( 'new data' ) );
    // No previous executions or cached results

    const engine: ReplayEngine = { incMetric, currentReplayIndex: 0, replayState, updateEventHistory }
    const replayFunction = withReplay ( activityId, {eventProcessor:replyEventProcessor}, fn );

    const result = await replayFunction ( engine ) ()

    expect ( result ).toBe ( 'new data' );
    expect ( fn ).toHaveBeenCalledTimes ( 1 );
    expect ( updateState ).toEqual ( [
      { "id": "testActivity", "success": "new data" }
    ] )
    expect ( metrics ).toEqual ( {} )
  } );

  it ( 'should throw a recorded error if the previous execution resulted in an error', async () => {
    const fn = jest.fn ( () => Promise.resolve ( 'new data' ) );
    replayState.push ( { id: activityId, failure: new Error ( 'Error during execution' ) } ); // Add a failed replay item

    const engine: ReplayEngine = { incMetric, currentReplayIndex: 0, replayState, updateEventHistory }
    const replayFunction = withReplay ( activityId, {eventProcessor:replyEventProcessor}, fn );

    const result = replayFunction ( engine ) ();
    // Expect the function to throw the recorded error
    await expect ( result ).rejects.toThrow ( 'Error during execution' );
    expect ( fn ).not.toHaveBeenCalled ();
    expect ( updateState ).toEqual ( [] )
    expect ( metrics ).toEqual ( { 'activity.replay.success': 1 } )
  } );
  it ( 'should throw an error if we try and process a paramsevent at location 0', async () => {
    const fn = async ( p: string ) => `using params ${p}`
    replayState.push ( { id: activityId, params: [ 'remembered' ] } ); // Add a params event

    const engine: ReplayEngine = { incMetric, currentReplayIndex: 0, replayState, updateEventHistory }
    const replayFunction = withReplay ( activityId, {eventProcessor:replyEventProcessor}, fn );
    const result = replayFunction ( engine ) ( "ignoredBecauseWeRememberedTheParams" );
    // Expect the function to throw the recorded error
    await expect ( result ).rejects.toThrow ( "Invalid params event. These should only occur at 'zero' and already have been processed: {\"id\":\"testActivity\",\"params\":[\"remembered\"]}" )
    expect ( updateState ).toEqual ( [] )
    expect ( metrics ).toEqual ( {
      "activity.replay.invalidParamsEvent": 1
    } )
  } )
  it ( 'should throw an error if we try and process a paramsevent after location 0', async () => {
    const fn = jest.fn ( () => Promise.resolve ( 'new data' ) );
    replayState.push (
      { id: activityId, success: `cached data: won't be used in this test, but we need something in position zero` },
      { id: activityId, params: 'params' } ); // Add a params event

    const engine: ReplayEngine = { incMetric, currentReplayIndex: 1, replayState, updateEventHistory }
    const replayFunction = withReplay ( activityId, {eventProcessor:replyEventProcessor}, fn );
    const result = replayFunction ( engine ) ();
    // Expect the function to throw the recorded error
    await expect ( result ).rejects.toThrow ( "Invalid params event. These should only occur at 'zero' and already have been processed: {\"id\":\"testActivity\",\"params\":\"params\"}" );
  } )

} )

