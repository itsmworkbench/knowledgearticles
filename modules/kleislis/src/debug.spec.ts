import { withDebug } from "./debug";
import { LogConfig0, LogLevel } from "./log";

const empty = {
  globalLogLevel: 'TRACE' as LogLevel,
  timeService: () => 1622547600000,
  correlationId: '12345',
  params: { a: '1', b: 2 },
  commonLogMessage: { 'testMessage': 'This is a test message' },
  mainTemplate: '{time} {level} [CorrelationId: {correlationId}] {message}',
}
describe ( 'withDebug', () => {
  it ( 'should log entering and exiting messages and return the function result', async () => {
    const storedLog: { level: LogLevel, message: string }[] = [];
    const log = ( lvl, message ) => storedLog.push ( { level: lvl, message } );

    const mockFn = jest.fn ().mockResolvedValue ( 'mock result' );
    const config: LogConfig0<any> & { id: string } = {
      id: 'testFunction',
      loglevel: 'INFO'
    };

    const result = await withDebug<number, number, number, number> ( config, log, mockFn ) ( 1, 2, 3 )

    expect ( result ).toBe ( 'mock result' );
    expect ( mockFn ).toHaveBeenCalled ();
    expect ( storedLog ).toEqual ( [
      {
        "level": "INFO",
        "message": "Entering testFunction with 1,2,3"
      },
      {
        "level": "INFO",
        "message": "Exiting testFunction with \"mock result\""
      }
    ] )
  } );

  it ( 'should log entering and exiting messages with custom templates and return the function result', async () => {
    const storedLog: { level: LogLevel, message: string }[] = [];
    const log = ( lvl, message ) => storedLog.push ( { level: lvl, message } );

    const mockFn = jest.fn ().mockResolvedValue ( 'mock result' );
    const config: LogConfig0<any> & { id: string } = {
      id: 'testFunction',
      loglevel: 'INFO',
      enterMessage: 'Custom {id} with {in} and {p1}',
      exitMessage: 'Custom {id} with {out}'
    };

    const wrappedFunction = withDebug ( config, log, mockFn );

    const result = await withDebug<number, number, number, number> ( config, log, mockFn ) ( 1, 2, 3 )

    expect ( result ).toBe ( 'mock result' );
    expect ( mockFn ).toHaveBeenCalled ();
    expect ( storedLog ).toEqual ( [
      {
        "level": "INFO",
        "message": "Custom testFunction with 1,2,3 and 1"
      },
      {
        "level": "INFO",
        "message": "Custom testFunction with \"mock result\""
      }
    ] )

  } )

  it ( 'should directly execute the function without logging if loglevel, enterMessage, and exitMessage are undefined', async () => {
    const storedLog: { level: LogLevel, message: string }[] = [];
    const log = ( lvl, message ) => storedLog.push ( { level: lvl, message } );

    const mockFn = jest.fn ().mockResolvedValue ( 'direct result' );
    const config: LogConfig0<any> & { id: string } = { id: 'directFunction' }; // No logging info

    const result = await withDebug<number, number, number, string> ( config, log, mockFn ) ( 1, 2, 3 )

    expect ( result ).toBe ( 'direct result' );
    expect ( mockFn ).toHaveBeenCalled ();
    expect ( storedLog ).toEqual ( [] )
  } );
} );

