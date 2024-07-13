import { promises as fs } from 'fs';
import { calculateSHA256, Digest, getDirectoriesRecursively, getFilesRecursively, transformFiles, TransformFilesConfig } from "./files";

async function readAll ( dir: string ) {
  const result: string[] = []
  for await ( const file of getFilesRecursively ( dir ) ) {
    const content: string = await fs.readFile ( file, 'utf-8' )
    result.push ( `${file.replaceAll ( '\\', '/' )}: ${content}` )
  }
  return result;
}
async function checkWithoutOld () {
  expect ( await readAll ( 'output' ) ).toEqual ([
    "output/a/a1.json: passed marker: false new: 9",
    "output/b/b1.json: passed marker: false new: 8",
    "output/test.json: passed marker: false new: 15"
  ] )
}
async function checkWithNew () {
  expect ( await readAll ( 'output' ) ).toEqual (    [
      "output/a/a1.json: passed marker: true new: 9",
      "output/b/b1.json: passed marker: true new: 8",
      "output/test.json: passed marker: true new: 15"
    ])
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
        fn: async ( s: string, marker: string | undefined, filenameFn ) => [ { file: filenameFn(0), content: `passed marker: ${marker !== undefined} new: ${s.length}` } ]
      } //= transformFiles (

      expect ( await transformFiles ( config ) ).toEqual ( { "failed": [], "readCount": 3, "writeCount": 3 ,  "markerErrors": [],} )
      await checkWithoutOld ();
      expect ( await transformFiles ( config ) ).toEqual ( { "failed": [], "readCount": 3, "writeCount": 3 ,  "markerErrors": [],} )
      await checkWithoutOld ();
    } );
    it ( 'should pass the marker to our letter count if they exist', async () => {
      const config: TransformFilesConfig = {
        filter: f => f.endsWith ( '.json' ),
        inputDir: 'test',
        outputDir: 'output',
        markerFn: async ( config, file ) => `${file}_marker`,
        fn: async ( s: string, marker: string | undefined, filenameFn ) => [ { file: filenameFn(0), content: `passed marker: ${marker !== undefined} new: ${s.length}` } ]
      } //= transformFiles (


      expect ( await transformFiles ( config ) ).toEqual ( { "failed": [], "readCount": 3, "writeCount": 3 , "markerErrors":[]} )
      await checkWithoutOld ();
      expect ( await transformFiles ( config ) ).toEqual ( { "failed": [], "readCount": 3, "writeCount": 3, "markerErrors":[] } )
      await checkWithNew ();
    } );
    it ( 'should not generate a file if the result of the fn is []]', async () => {

      const config: TransformFilesConfig = {
        filter: f => f.endsWith ( '.json' ),
        inputDir: 'test',
        outputDir: 'output',
        markerFn: async ( config, file ) => `${file}_marker`,
        fn: async ( s: string, old: string | undefined,filenameFn) => s.length === 8 ? [] : [ { file:filenameFn(0), content: 'result' } ],
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


  const simpleDigest: Digest = async ( s: string ) => {
    // Simple digest function for testing
    return `simple-sha-${s}`;
  };

  const simpleGetShaFromOutput = async ( output: string | undefined ) => {
    // Simple function to extract SHA from output for testing
    return output ? `simple-sha-${output}` : '';
  };

} );
