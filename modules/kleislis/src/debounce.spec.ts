import { debounce, debounceK } from './debounce';

describe ( 'debounce', () => {
  test ( 'calls the debounced function once and waits for the result', async () => {
    const output: string[] = [];

    const appendToOutput = ( message: string ) => {
      output.push ( message );
      return message;
    };

    const debouncedAppendToOutput = debounce ( appendToOutput, 20 );

    // Call the debounced function once
    const result = await debouncedAppendToOutput ( 'first' );

    // Wait for the debounce delay to ensure the function was called
    await new Promise ( ( resolve ) => setTimeout ( resolve, 30 ) );

    // Check the output array
    expect ( output ).toEqual ( [ 'first' ] );

    // Check the returned result
    expect ( result ).toBe ( 'first' );
  } );

  test ( 'calls the debounced function twice within the debounce period', async () => {
    const output: string[] = [];

    const appendToOutput = ( message: string ) => {
      output.push ( message );
      return message;
    };

    const debouncedAppendToOutput = debounce ( appendToOutput, 20 );

    // Call the debounced function twice within the debounce period
    debouncedAppendToOutput ( 'first' );
    const result = await debouncedAppendToOutput ( 'second' );

    // Wait for the debounce delay to ensure the function was called
    await new Promise ( ( resolve ) => setTimeout ( resolve, 30 ) );

    // Check the output array
    expect ( output ).toEqual ( [ 'second' ] );

    // Check the returned result
    expect ( result ).toBe ( 'second' );
  } );

  test ( 'calls the debounced function twice outside the debounce period', async () => {
    const output: string[] = [];

    const appendToOutput = ( message: string ) => {
      output.push ( message );
      return message;
    };

    const debouncedAppendToOutput = debounce ( appendToOutput, 20 );

    // Call the debounced function twice, with enough delay between them
    const result1 = await debouncedAppendToOutput ( 'first' );
    await new Promise ( ( resolve ) => setTimeout ( resolve, 30 ) ); // Wait for debounce period to pass
    const result2 = await debouncedAppendToOutput ( 'second' );

    // Wait for the debounce delay to ensure the function was called
    await new Promise ( ( resolve ) => setTimeout ( resolve, 30 ) );

    // Check the output array
    expect ( output ).toEqual ( [ 'first', 'second' ] );

    // Check the returned results
    expect ( result1 ).toBe ( 'first' );
    expect ( result2 ).toBe ( 'second' );
  } );
} );


describe ( 'debounceK', () => {
  test ( 'calls the debounced function once and waits for the result', async () => {
    const output: string[] = [];

    const appendToOutput = async ( message: string ): Promise<string> => {
      output.push ( message );
      return message;
    };

    const debouncedAppendToOutput = debounceK ( appendToOutput, 20 );

    // Call the debounced function once
    const result = await debouncedAppendToOutput ( 'first' );

    // Wait for the debounce delay to ensure the function was called
    await new Promise ( ( resolve ) => setTimeout ( resolve, 30 ) );

    // Check the output array
    expect ( output ).toEqual ( [ 'first' ] );

    // Check the returned result
    expect ( result ).toBe ( 'first' );
  } );

  test ( 'calls the debounced function twice within the debounce period', async () => {
    const output: string[] = [];

    const appendToOutput = async ( message: string ): Promise<string> => {
      output.push ( message );
      return message;
    };

    const debouncedAppendToOutput = debounceK ( appendToOutput, 20 );

    // Call the debounced function twice within the debounce period
    debouncedAppendToOutput ( 'first' );
    const result = await debouncedAppendToOutput ( 'second' );

    // Wait for the debounce delay to ensure the function was called
    await new Promise ( ( resolve ) => setTimeout ( resolve, 30 ) );

    // Check the output array
    expect ( output ).toEqual ( [ 'second' ] );

    // Check the returned result
    expect ( result ).toBe ( 'second' );
  } );

  test ( 'calls the debounced function twice outside the debounce period', async () => {
    const output: string[] = [];

    const appendToOutput = async ( message: string ): Promise<string> => {
      output.push ( message );
      return message;
    };

    const debouncedAppendToOutput = debounceK ( appendToOutput, 20 );

    // Call the debounced function twice, with enough delay between them
    const result1 = await debouncedAppendToOutput ( 'first' );
    await new Promise ( ( resolve ) => setTimeout ( resolve, 30 ) ); // Wait for debounce period to pass
    const result2 = await debouncedAppendToOutput ( 'second' );

    // Wait for the debounce delay to ensure the function was called
    await new Promise ( ( resolve ) => setTimeout ( resolve, 30 ) );

    // Check the output array
    expect ( output ).toEqual ( [ 'first', 'second' ] );

    // Check the returned results
    expect ( result1 ).toBe ( 'first' );
    expect ( result2 ).toBe ( 'second' );
  } );
} );
