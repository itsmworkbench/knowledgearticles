import { Throttling } from "@itsmworkbench/kleislis";
import { configToThrottling, SumariseReport, SummariseAi, SummariseConfig, SummariseDirectories, SummariseNonfunctionals, SummariseSchema, SummariseTika, validateAi, validateConfig, validateDirectory, validateNonfunctionals, validateReport, validateSchema, validateTika } from "./summarise.config";
import { defaultYaml } from "./default.yaml";
import { jsYaml } from "@itsmworkbench/jsyaml";
import { hasErrors } from "@laoban/utils";

describe ( 'configToThrottling', () => {
  it ( 'should convert SummariseNonfunctionals to Throttling correctly', () => {
    const config: SummariseNonfunctionals = {
      throttlingPerHour: 3600,
      concurrent: 10,
      retry: {
        initialInterval: 1000,
        maximumInterval: 5000,
        maximumAttempts: 3
      }
    };

    const expectedThrottling: Throttling = {
      tokensPer100ms: 0.01,
      max: 3600,
      current: 3600
    };

    const result = configToThrottling ( config );

    expect ( result ).toEqual ( expectedThrottling );
  } );

  it ( 'should handle throttlingPerHour correctly for different values', () => {
    const config: SummariseNonfunctionals = {
      throttlingPerHour: 7200,
      concurrent: 5,
      retry: {
        initialInterval: 500,
        maximumInterval: 2500,
        maximumAttempts: 5
      }
    };

    const expectedThrottling: Throttling = {
      tokensPer100ms: 0.02,
      max: 7200,
      current: 7200
    };

    const result = configToThrottling ( config );

    expect ( result ).toEqual ( expectedThrottling );
  } );

  it ( 'should handle edge case where throttlingPerHour is 0', () => {
    const config: SummariseNonfunctionals = {
      throttlingPerHour: 0,
      concurrent: 5,
      retry: {
        initialInterval: 500,
        maximumInterval: 2500,
        maximumAttempts: 5
      }
    };

    const expectedThrottling: Throttling = {
      tokensPer100ms: 0,
      max: 0,
      current: 0
    };

    const result = configToThrottling ( config );

    expect ( result ).toEqual ( expectedThrottling );
  } );
} );

describe ( 'validateDirectory', () => {
  it ( 'should validate a correct directories object', () => {
    const directories: SummariseDirectories = {
      inputs: 'inputsDir',
      tika: 'tikaDir',
      text: 'textDir',
      summary: 'summaryDir'
    };

    const result = validateDirectory ( directories );
    expect ( result ).toEqual ( [] );
  } );

  it ( 'should return errors if directories object is not an object', () => {
    const result = validateDirectory ( null as any );
    expect ( result ).toEqual ( [ 'Directories is not an object' ] );
  } );

  it ( 'should return errors if directories.inputs is missing', () => {
    const directories: Partial<SummariseDirectories> = {
      tika: 'tikaDir',
      text: 'textDir',
      summary: 'summaryDir'
    };

    const result = validateDirectory ( directories as SummariseDirectories );
    expect ( result ).toEqual ( [ 'directories.inputs is not defined' ] );
  } );

  it ( 'should return errors if directories.tika is missing', () => {
    const directories: Partial<SummariseDirectories> = {
      inputs: 'inputsDir',
      text: 'textDir',
      summary: 'summaryDir'
    };

    const result = validateDirectory ( directories as SummariseDirectories );
    expect ( result ).toEqual ( [ 'directories.tika is not defined' ] );
  } );

  it ( 'should return errors if directories.text is missing', () => {
    const directories: Partial<SummariseDirectories> = {
      inputs: 'inputsDir',
      tika: 'tikaDir',
      summary: 'summaryDir'
    };

    const result = validateDirectory ( directories as SummariseDirectories );
    expect ( result ).toEqual ( [ 'directories.text is not defined' ] );
  } );

  it ( 'should return errors if directories.summary is missing', () => {
    const directories: Partial<SummariseDirectories> = {
      inputs: 'inputsDir',
      tika: 'tikaDir',
      text: 'textDir'
    };

    const result = validateDirectory ( directories as SummariseDirectories );
    expect ( result ).toEqual ( [ 'directories.summary is not defined' ] );
  } );

  it ( 'should return errors if any field is not a string', () => {
    const directories: any = {
      inputs: 'inputsDir',
      tika: 123,
      text: 'textDir',
      summary: 'summaryDir'
    };

    const result = validateDirectory ( directories );
    expect ( result ).toEqual ( [ 'directories.tika is not a string' ] );
  } );
} );

describe ( 'validateAi', () => {
  it ( 'should validate a correct ai object', () => {
    const ai: SummariseAi = {
      type: 'openai',
      url: 'https://api.openai.com',
      model: 'text-davinci-003',
      token: 'dummyToken'
    };

    const result = validateAi ( ai );
    expect ( result ).toEqual ( [] );
  } );

  it ( 'should return errors if ai object is not an object', () => {
    const result = validateAi ( null as any );
    expect ( result ).toEqual ( [ 'ai is not an object' ] );
  } );

  it ( 'should return errors if ai.type is missing', () => {
    const ai: Partial<SummariseAi> = {
      url: 'https://api.openai.com',
      model: 'text-davinci-003',
      token: 'dummyToken'
    };

    const result = validateAi ( ai as SummariseAi );
    expect ( result ).toEqual ( [ 'ai.type is not defined' ] );
  } );

  it ( 'should return errors if ai.type is not "openai"', () => {
    const ai: SummariseAi = {
      type: 'otherai' as any,
      url: 'https://api.openai.com',
      model: 'text-davinci-003',
      token: 'dummyToken'
    };

    const result = validateAi ( ai );
    expect ( result ).toEqual ( [ 'Invalid AI type. Currently only openai allowed' ] );
  } );

  it ( 'should return errors if ai.url is missing', () => {
    const ai: Partial<SummariseAi> = {
      type: 'openai',
      model: 'text-davinci-003',
      token: 'dummyToken'
    };

    const result = validateAi ( ai as SummariseAi );
    expect ( result ).toEqual ( [ 'ai.url is not defined' ] );
  } );

  it ( 'should return errors if ai.model is missing', () => {
    const ai: Partial<SummariseAi> = {
      type: 'openai',
      url: 'https://api.openai.com',
      token: 'dummyToken'
    };

    const result = validateAi ( ai as SummariseAi );
    expect ( result ).toEqual ( [ 'ai.model is not defined' ] );
  } );

  it ( 'should return errors if ai.token is missing', () => {
    const ai: Partial<SummariseAi> = {
      type: 'openai',
      url: 'https://api.openai.com',
      model: 'text-davinci-003'
    };

    const result = validateAi ( ai as SummariseAi );
    expect ( result ).toEqual ( [ 'ai.token is not defined' ] );
  } );

  it ( 'should return errors if any field is not a string', () => {
    const ai: any = {
      type: 'openai',
      url: 123,
      model: 'text-davinci-003',
      token: 'dummyToken'
    };

    const result = validateAi ( ai );
    expect ( result ).toEqual ( [ 'ai.url is not a string' ] );
  } );
} );


describe ( 'validateNonfunctionals', () => {
  it ( 'should validate a correct nonfunctionals object', () => {
    const nonfunctionals = {
      throttlingPerHour: 3600,
      concurrent: 10,
      retry: {
        initialInterval: 1000,
        maximumInterval: 5000,
        maximumAttempts: 3
      }
    };

    const result = validateNonfunctionals ( nonfunctionals );
    expect ( result ).toEqual ( [] );
  } );

  it ( 'should return errors if nonfunctionals object is not an object', () => {
    const result = validateNonfunctionals ( null as any );
    expect ( result ).toEqual ( [ 'Nonfunctionals is not an object' ] );
  } );

  it ( 'should return errors if nonfunctionals.throttlingPerHour is missing', () => {
    const nonfunctionals = {
      concurrent: 10,
      retry: {
        initialInterval: 1000,
        maximumInterval: 5000,
        maximumAttempts: 3
      }
    };

    const result = validateNonfunctionals ( nonfunctionals as any );
    expect ( result ).toEqual ( [ 'nonfunctionals.throttlingPerHour is not defined' ] );
  } );

  it ( 'should return errors if nonfunctionals.concurrent is missing', () => {
    const nonfunctionals = {
      throttlingPerHour: 3600,
      retry: {
        initialInterval: 1000,
        maximumInterval: 5000,
        maximumAttempts: 3
      }
    };

    const result = validateNonfunctionals ( nonfunctionals as any );
    expect ( result ).toEqual ( [ 'nonfunctionals.concurrent is not defined' ] );
  } );

  it ( 'should return not generate errors if nonfunctionals.retry is missing', () => {
    const nonfunctionals = {
      throttlingPerHour: 3600,
      concurrent: 10
    };

    const result = validateNonfunctionals ( nonfunctionals as any );
    expect ( result ).toEqual ( [] );
  } );

  it ( 'should return errors if nonfunctionals.throttlingPerHour is not a number', () => {
    const nonfunctionals = {
      throttlingPerHour: 'not-a-number',
      concurrent: 10,
      retry: {
        initialInterval: 1000,
        maximumInterval: 5000,
        maximumAttempts: 3
      }
    };

    const result = validateNonfunctionals ( nonfunctionals as any );
    expect ( result ).toEqual ( [ 'nonfunctionals.throttlingPerHour is not a number' ] );
  } );

  it ( 'should return errors if nonfunctionals.concurrent is not a number', () => {
    const nonfunctionals = {
      throttlingPerHour: 3600,
      concurrent: 'not-a-number',
      retry: {
        initialInterval: 1000,
        maximumInterval: 5000,
        maximumAttempts: 3
      }
    };

    const result = validateNonfunctionals ( nonfunctionals as any );
    expect ( result ).toEqual ( [ 'nonfunctionals.concurrent is not a number' ] );
  } );

  it ( 'should return errors if retry fields are not numbers', () => {
    const nonfunctionals = {
      throttlingPerHour: 3600,
      concurrent: 10,
      retry: {
        initialInterval: 'not-a-number',
        maximumInterval: 'not-a-number',
        maximumAttempts: 'not-a-number'
      }
    };

    const result = validateNonfunctionals ( nonfunctionals as any );
    expect ( result ).toEqual ( [
      'retry.initialInterval is not a number',
      'retry.maximumInterval is not a number',
      'retry.maximumAttempts is not a number'
    ] );
  } );
} );

describe ( 'validateSchema', () => {
  it ( 'should validate a correct schema object', () => {
    const schema: SummariseSchema = {
      type: 'inline',
      value: {}
    };

    const result = validateSchema ( schema );
    expect ( result ).toEqual ( [] );
  } );

  it ( 'should return errors if schema object is not an object', () => {
    const result = validateSchema ( null as any );
    expect ( result ).toEqual ( [ 'Schema is not an object' ] );
  } );

  it ( 'should return errors if schema.type is missing', () => {
    const schema = {
      value: {}
    };

    const result = validateSchema ( schema as any );
    expect ( result ).toEqual ( [ 'schema.type is not defined' ] );
  } );

  it ( 'should return errors if schema.type is not "inline"', () => {
    const schema = {
      type: 'external',
      value: {}
    };

    const result = validateSchema ( schema as any );
    expect ( result ).toEqual ( [ 'Invalid schema type. Currently only inline allowed' ] );
  } );

  it ( 'should return errors if schema.value is missing', () => {
    const schema = {
      type: 'inline'
    };

    const result = validateSchema ( schema as any );
    expect ( result ).toEqual ( [ 'schema.value is not defined' ] );
  } );

  it ( 'should return errors if schema.type is not a string', () => {
    const schema = {
      type: 123,
      value: {}
    };

    const result = validateSchema ( schema as any );
    expect ( result ).toEqual ( [ 'schema.type is not a string' ] );
  } );

  it ( 'should return errors if schema.value is undefined', () => {
    const schema = {
      type: 'inline',
      value: undefined
    };

    const result = validateSchema ( schema as any );
    expect ( result ).toEqual ( [ 'schema.value is not defined' ] );
  } );
} );


describe ( 'validateTika', () => {
  it ( 'should validate a correct tika object', () => {
    const tika: SummariseTika = {
      type: 'jar',
      jar: 'path/to/jarfile'
    };

    const result = validateTika ( tika );
    expect ( result ).toEqual ( [] );
  } );

  it ( 'should return errors if tika object is not an object', () => {
    const result = validateTika ( null as any );
    expect ( result ).toEqual ( [ 'Tika is not an object' ] );
  } );

  it ( 'should return errors if tika.type is missing', () => {
    const tika = {
      jar: 'path/to/jarfile'
    };

    const result = validateTika ( tika as any );
    expect ( result ).toEqual ( [ 'tika.type is not defined' ] );
  } );

  it ( 'should return errors if tika.type is not "jar"', () => {
    const tika = {
      type: 'other',
      jar: 'path/to/jarfile'
    };

    const result = validateTika ( tika as any );
    expect ( result ).toEqual ( [ 'Invalid tika type. Currently only jar allowed' ] );
  } );

  it ( 'should return errors if tika.jar is missing', () => {
    const tika = {
      type: 'jar'
    };

    const result = validateTika ( tika as any );
    expect ( result ).toEqual ( [ 'tika.jar is not defined' ] );
  } );

  it ( 'should return errors if tika.type is not a string', () => {
    const tika = {
      type: 123,
      jar: 'path/to/jarfile'
    };

    const result = validateTika ( tika as any );
    expect ( result ).toEqual ( [ 'tika.type is not a string' ] );
  } );

  it ( 'should return errors if tika.jar is not a string', () => {
    const tika = {
      type: 'jar',
      jar: 123
    };

    const result = validateTika ( tika as any );
    expect ( result ).toEqual ( [ 'tika.jar is not a string' ] );
  } );
} );


describe ( 'validateReport', () => {
  it ( 'should validate a correct report object', () => {
    const report: SumariseReport = {
      categories: [ 'category1', 'category2' ],
      fields: {
        field1: { type: 'enum', enum: [ 'value1', 'value2' ] },
        field2: { type: 'number' }
      }
    };

    const result = validateReport ( report );
    expect ( result ).toEqual ( [] );
  } );

  it ( 'should return errors if report object is not an object', () => {
    const result = validateReport ( null as any );
    expect ( result ).toEqual ( [ 'Report is not an object' ] );
  } );

  it ( 'should return errors if report.fields is undefined', () => {
    const report = {
      categories: [ 'category1', 'category2' ]
    };

    const result = validateReport ( report as any );
    expect ( result ).toEqual ( [ 'report.fields is not defined' ] );
  } );

  it ( 'should return errors if report.fields is not an object', () => {
    const report = {
      categories: [ 'category1', 'category2' ],
      fields: 'not-an-object'
    };

    const result = validateReport ( report as any );
    expect ( result ).toEqual ( [ 'report.fields is not an object' ] );
  } );

  it ( 'should return errors if report.categories is undefined', () => {
    const report = {
      fields: {
        field1: { type: 'enum', enum: [ 'value1', 'value2' ] },
        field2: { type: 'number' }
      }
    };

    const result = validateReport ( report as any );
    expect ( result ).toEqual ( [ 'report.categories is not defined' ] );
  } );

  it ( 'should return errors if report.categories is not an array', () => {
    const report = {
      categories: 'not-an-array',
      fields: {
        field1: { type: 'enum', enum: [ 'value1', 'value2' ] },
        field2: { type: 'number' }
      }
    };

    const result = validateReport ( report as any );
    expect ( result ).toEqual ( [ 'report.categories is not an array' ] );
  } );

  it ( 'should return errors if report.fields.field is not an object', () => {
    const report = {
      categories: [ 'category1', 'category2' ],
      fields: {
        field1: 'not-an-object'
      }
    };

    const result = validateReport ( report as any );
    expect ( result ).toEqual ( [ 'report.fields.field1 is not an object' ] );
  } );

  it ( 'should return errors if report.fields.field.type is not defined', () => {
    const report = {
      categories: [ 'category1', 'category2' ],
      fields: {
        field1: {}
      }
    };

    const result = validateReport ( report as any );
    expect ( result ).toEqual ( [ 'report.fields.field1.type is not defined' ] );
  } );

  it ( 'should return errors if report.fields.field.type is not valid', () => {
    const report = {
      categories: [ 'category1', 'category2' ],
      fields: {
        field1: { type: 'invalid' }
      }
    };

    const result = validateReport ( report as any );
    expect ( result ).toEqual ( [ 'report.fields.field1.type is not valid' ] );
  } );

  it ( 'should return errors if report.fields.field.type is enum and enum is not defined', () => {
    const report = {
      categories: [ 'category1', 'category2' ],
      fields: {
        field1: { type: 'enum' }
      }
    };

    const result = validateReport ( report as any );
    expect ( result ).toEqual ( [ 'report.fields.field1.enum is not defined' ] );
  } );

  it ( 'should return errors if report.fields.field.type is enum and enum is not an array', () => {
    const report = {
      categories: [ 'category1', 'category2' ],
      fields: {
        field1: { type: 'enum', enum: 'not-an-array' }
      }
    };

    const result = validateReport ( report as any );
    expect ( result ).toEqual ( [ 'report.fields.field1.enum is not an array' ] );
  } );
} );


describe ( 'validateConfig', () => {
  it ( 'should validate the default YAML configuration without errors', () => {
    const config = jsYaml ().parser ( defaultYaml ) as SummariseConfig;
    if ( hasErrors ( config ) ) throw new Error ( 'Invalid default YAML configuration' )

    const result = validateConfig ( config );

    expect ( result ).toEqual ( config );
  } );

  it ( 'should return errors for an empty configuration object', () => {
    const emptyConfig = {} as SummariseConfig;

    const result = validateConfig ( emptyConfig );

    expect ( result ).toEqual ( [
      "Directories is not an object",
      "ai is not an object",
      "Tika is not an object",
      "Nonfunctionals is not an object",
      "Schema is not an object",
      "prompt is not defined",
      "Report is not an object"
    ] );
  } );
} );