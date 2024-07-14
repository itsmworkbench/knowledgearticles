import { promises as fs } from 'fs';
import { calculateSHA256, Digest, getDirectoriesRecursively, getFilesRecursively, markerIsFieldInOldFile, markerIsFromJsonInOldFile, markerIsFromOldFile, markerIsShaInOldFile, transformFiles, TransformFilesConfig } from "./files";
import path from "node:path";

async function readAll ( dir: string ) {
  const result: string[] = []
  for await ( const file of getFilesRecursively ( dir ) ) {
    const content: string = await fs.readFile ( file, 'utf-8' )
    result.push ( `${file.replaceAll ( '\\', '/' )}: ${content}` )
  }
  return result;
}
describe ( 'files', () => {
  describe ( 'getFilesRecursively', () => {
    it ( 'should read over files', async () => {
      const result: string[] = []
      for await ( const file of getFilesRecursively ( 'test', f => f.endsWith ( '.json' ) ) ) {
        result.push ( file.replaceAll ( '\\', '/' ) )
      }
      expect ( result ).toEqual ( [
        "test/a/a1.json",
        "test/b/b1.json",
        "test/test.json"
      ] )
    } )
  } )
  describe ( "getDirectoriesRecursively", () => {
    it ( "should read over directories", async () => {
      const result: string[] = [];
      for await ( const dir of getDirectoriesRecursively ( "test" ) ) {
        result.push ( dir.replaceAll ( "\\", "/" ) );
      }
      expect ( result ).toEqual ( [ "test", "test/a", "test/b" ] );
    } );
  } )

  describe ( "transformFiles", () => {
    beforeEach ( async () => {
      await fs.rm ( 'output', { recursive: true, force: true } )
    } );
    afterAll ( async () => {
      await fs.rm ( 'output', { recursive: true, force: true } )
    } )
    it ( 'should generate an output file that is the letter count of the output. Does not send old if not asked', async () => {
      const config: TransformFilesConfig = {
        filter: f => f.endsWith ( '.json' ),
        inputDir: 'test',
        outputDir: 'output',
        readFile: file => fs.readFile ( file, 'utf8' ),
        fn: async ( s: string, marker: string | undefined, filenameFn ) => [ { file: filenameFn ( 0 ), content: `passed marker: ${marker} new: ${s.length}` } ]
      } //= transformFiles (

      expect ( await transformFiles ( config ) ).toEqual ( { "failed": [], "readCount": 3, "writeCount": 3, "markerErrors": [], } )
      let expected = [
        "output/a/a1.json: passed marker: undefined new: 9",
        "output/b/b1.json: passed marker: undefined new: 8",
        "output/test.json: passed marker: undefined new: 15"
      ];
      await expect ( await readAll ( 'output' ) ).toEqual ( expected );
      expect ( await transformFiles ( config ) ).toEqual ( { "failed": [], "readCount": 3, "writeCount": 3, "markerErrors": [], } )
      await expect ( await readAll ( 'output' ) ).toEqual ( expected );
    } );
    it ( 'should pass the marker to our letter count if they exist', async () => {
      const config: TransformFilesConfig = {
        filter: f => f.endsWith ( '.json' ),
        inputDir: 'test',
        outputDir: 'output',
        readFile: file => fs.readFile ( file, 'utf8' ),
        markerFn: async ( config, file ) => `${file}_marker`,
        fn: async ( s: string, marker: string | undefined, filenameFn ) => [ { file: filenameFn ( 0 ), content: `passed marker: ${marker} new: ${s.length}` } ]
      } //= transformFiles (


      expect ( await transformFiles ( config ) ).toEqual ( { "failed": [], "readCount": 3, "writeCount": 3, "markerErrors": [] } )
      let expected = [
        "output/a/a1.json: passed marker: test\\a\\a1.json_marker new: 9",
        "output/b/b1.json: passed marker: test\\b\\b1.json_marker new: 8",
        "output/test.json: passed marker: test\\test.json_marker new: 15"
      ];
      await expect ( await readAll ( 'output' ) ).toEqual ( expected );
      expect ( await transformFiles ( config ) ).toEqual ( { "failed": [], "readCount": 3, "writeCount": 3, "markerErrors": [] } )
      await expect ( await readAll ( 'output' ) ).toEqual ( expected );
    } );
    it ( 'should not generate a file if the result of the fn is []]', async () => {

      const config: TransformFilesConfig = {
        filter: f => f.endsWith ( '.json' ),
        inputDir: 'test',
        outputDir: 'output',
        readFile: file => fs.readFile ( file, 'utf8' ),
        markerFn: async ( config, file ) => `${file}_marker`,
        fn: async ( s: string, old: string | undefined, filenameFn ) => s.length === 8 ? [] : [ { file: filenameFn ( 0 ), content: 'result' } ],
      } //= tran
      await transformFiles ( config )
      await expect ( await readAll ( 'output' ) ).toEqual ( [
        "output/a/a1.json: result",
        "output/test.json: result" ] );
    } );
  } );
  describe ( 'calculateSHA256', () => {
    test ( 'should calculate SHA-256 hash of a string', async () => {
      const input = 'test string';
      const result = await calculateSHA256 ( input );
      expect ( result ).toBe ( '1VecRt_MfxggcBPmW0Tky04sIpj0rEV7qPgnQ_Mekws' );
    } );

    test ( 'should calculate SHA-256 hash of an empty string', async () => {
      const input = '';
      const result = await calculateSHA256 ( input );
      expect ( result ).toBe ( '47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU' );
    } );
  } );


  describe ( 'marker functions', () => {

    const mockReadFile = ( fileContent: Record<string, string> ) => {
      return async ( filePath: string ) => {
        let file = filePath.replaceAll ( '\\', '/' )
        if ( fileContent[ file ] ) {
          return Promise.resolve ( fileContent[ file ] );
        }
        return Promise.reject ( new Error ( `File not found` ) );
      };
    };

    const createConfig = ( fileContent: Record<string, string> ): TransformFilesConfig => ({
      inputDir: 'input',
      outputDir: 'output',
      fn: () => Promise.reject ( 'dont call me' ),
      readFile: mockReadFile ( fileContent ),
    });

    it ( 'markerIsFromOldFile should return correct marker', async () => {
      const config = createConfig ( {
        'output/file1.txt': 'markerContent',
      } );

      const findMarker = ( fileName: string, content: string ) => content.includes ( 'marker' ) ? 'marker' : undefined;

      const markerFn = markerIsFromOldFile ( findMarker );
      const result = await markerFn ( config, 'input/file1.txt' );
      expect ( result ).toBe ( 'marker' );
    } );

    it ( 'markerIsFromJsonInOldFile should return correct marker from JSON content', async () => {
      const config = createConfig ( {
        'output/file2.json': JSON.stringify ( { sha: '123456' } ),
      } );

      const findMarker = ( json: any ) => json.sha;

      const markerFn = markerIsFromJsonInOldFile ( findMarker );
      const result = await markerFn ( config, 'input/file2.json' );
      expect ( result ).toBe ( '123456' );
    } );

    it ( 'markerIsFieldInOldFile should return correct field value from JSON content', async () => {
      const config = createConfig ( {
        'output/file3.json': JSON.stringify ( { sha: 'abcdef' } ),
      } );

      const markerFn = markerIsFieldInOldFile ( 'sha' );
      const result = await markerFn ( config, 'input/file3.json' );
      expect ( result ).toBe ( 'abcdef' );
    } );

    it ( 'markerIsShaInOldFile should return correct sha value from JSON content', async () => {
      const config = createConfig ( {
        'output/file4.json': JSON.stringify ( { sha: '654321' } ),
      } );

      const result = await markerIsShaInOldFile ( config, 'input/file4.json' );
      expect ( result ).toBe ( '654321' );
    } );

    it ( 'marker functions should return undefined if file does not exist', async () => {
      const config = createConfig ( {} );

      const result1 = await markerIsShaInOldFile ( config, 'nonexistent.json' );
      expect ( result1 ).toBeUndefined ();

      const markerFn = markerIsFieldInOldFile ( 'sha' );
      const result2 = await markerFn ( config, 'nonexistent.json' );
      expect ( result2 ).toBeUndefined ();
    } );

    it ( 'marker functions should return undefined if marker not found', async () => {
      const config = createConfig ( {
        '/output/file5.json': JSON.stringify ( {} ),
      } );

      const result = await markerIsShaInOldFile ( config, 'file5.json' );
      expect ( result ).toBeUndefined ();
    } );
  } );

  const simpleDigest: Digest = async ( s: string ) => {
    // Simple digest function for testing
    return `simple-sha-${s}`;
  };

  const simpleGetShaFromOutput = async ( output: string | undefined ) => {
    // Simple function to extract SHA from output for testing
    return output ? `simple-sha-${output}` : '';
  };

} );
