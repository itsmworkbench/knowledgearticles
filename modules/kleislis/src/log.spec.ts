import { LogConfig1, LogLevel, makeObjectFromParams, makeObjectFromParamsAndOutput } from "./log";

describe ( 'makeObjectFromParams', () => {
  it ( 'should handle simple parameter extraction correctly', () => {
    const template = '{p1}, {p2}, {p3}';
    const args = [ 'hello', 'world', 123 ];
    const config = {};
    const result = makeObjectFromParams ( config, template, args );
    expect ( result ).toEqual ( { p1: '"hello"', p2: '"world"', p3: '123' } );
  } );

  it ( 'should return undefined for out-of-bounds parameters', () => {
    const template = '{p1}, {p2}, {p3}, {p4}';
    const args = [ 'hello', 'world' ];
    const config = {};
    const result = makeObjectFromParams ( config, template, args );
    expect ( result.p4 ).toBeUndefined ();
  } );

  it ( 'should use custom formatter if available', () => {
    const template = '{p1}, {p2}';
    const args = [ 42, true ];
    const config = {
      formatInput1: ( param: any ) => `Number: ${param}`,
      formatInput2: ( param: any ) => `Boolean: ${param}`,
    };
    const result = makeObjectFromParams ( config, template, args );
    expect ( result ).toEqual ( { p1: 'Number: 42', p2: 'Boolean: true' } );
  } );

  it ( 'should handle "in" to concatenate all inputs', () => {
    const template = '{in}';
    const args = [ 'one', 'two', 'three' ];
    const config = {};
    const result = makeObjectFromParams ( config, template, args );
    expect ( result.in ).toEqual ( '"one","two","three"' );
  } );

  it ( 'should handle null and undefined inputs properly', () => {
    const template = '{p1}, {p2}';
    const args = [ null, undefined ];
    const config = {};
    const result = makeObjectFromParams ( config, template, args );
    expect ( result ).toEqual ( { p1: 'null', p2: 'undefined' } );
  } );

  it ( 'should handle errors in custom formatter gracefully', () => {
    const template = '{p1}';
    const args = [ 42 ];
    const config: LogConfig1<string, string> = {
      formatInput1: (): string => { throw new Error ( 'Test Error' ); }
    };
    const result = makeObjectFromParams ( config, template, args );
    expect ( result.p1 ).toEqual ( '42' ); // fallback to param.toString() in the catch block
  } );
} );

describe ( "makeObjectFromParamsAndOutput", () => {
  it ( 'should handle simple output (no function and a serialisable value) correctly', () => {
    const template = '{p1}, {p2}';
    const args = [ 'hello', 'world' ];
    const output = 'output';
    const config = {};
    const result = makeObjectFromParamsAndOutput ( config, template, args, output );
    expect ( result ).toEqual ( { p1: '"hello"', p2: '"world"', out: '"output"' } );
  } )
  it ( "should handle output being null", () => {
    const template = '{p1}, {p2}';
    const args = [ 'hello', 'world' ];
    const output = null;
    const config = {};
    const result = makeObjectFromParamsAndOutput ( config, template, args, output );
    expect ( result ).toEqual ( { p1: '"hello"', p2: '"world"', out: 'null' } );
  } )
  it ( "should modify the output with a function if provided in config", () => {
    const template = '{p1}, {p2}';
    const args = [ 'hello', 'world' ];
    const output = 'output';
    const config = {
      formatOutput: ( output: any ) => output.toUpperCase ()
    };
    const result = makeObjectFromParamsAndOutput ( config, template, args, output );
    expect ( result ).toEqual ( { p1: '"hello"', p2: '"world"', out: 'OUTPUT' } );
  } )
  it ( "should resort to toString if the output function throws an error", () => {
    const template = '{p1}, {p2}';
    const args = [ 'hello', 'world' ];
    const output = 'output';
    const config: LogConfig1<string, string> = {
      formatOutput: () => { throw new Error ( 'Test Error' ); }
    };
    const result = makeObjectFromParamsAndOutput ( config, template, args, output );
    expect ( result ).toEqual ( { p1: '"hello"', p2: '"world"', out: 'output' } );
  } )

} )
