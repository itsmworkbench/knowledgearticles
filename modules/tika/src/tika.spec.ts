import axios from 'axios';

import path from 'path';
import * as fs from 'fs/promises';
import { startServer, stopServer, TikaServer } from "./tika.server";
import { findType, processDocument, TikaClient } from "./tika.client";
import { calculateSHA256, sha256FromBuffer } from "@summarisation/fileutils";

function cleaned ( result: string ) {
  return result.split ( '\n' ).map ( ( line: string ) => line.trim () ).filter ( ( line: string ) => line.length > 0 ).join ( '\n' );
}
describe ( 'Tika', () => {
  const tikaServer: TikaServer & TikaClient = {
    jar: '../../tika-server-standard-2.9.2.jar',
    process: null,
    host: '127.0.0.1',
    port: 9998,
    debug: true
  };

  beforeAll ( async () => {
    await startServer ( tikaServer );
  } );

  afterAll ( async () => {
    await stopServer ( tikaServer );
  } );

  describe ( 'Tika Server', () => {
    it ( 'should respond to the / endpoint', async () => {
      const response = await axios.get ( `http://${tikaServer.host}:${tikaServer.port}/` );
      expect ( response.status ).toBe ( 200 );
      expect ( response.data ).toContain ( 'Welcome to the Apache Tika' );
    } );
  } );

  describe ( 'processDocument', () => {
    async function loadExpectedResult ( fileName: string ): Promise<string> {
      const filePath = path.resolve ( process.cwd (), 'test', fileName );
      const fileContent = await fs.readFile ( filePath, 'utf-8' );
      return cleaned(fileContent);
    }

    async function loadDocument ( fileName: string ): Promise<Buffer> {
      const filePath = path.resolve ( process.cwd (), 'test', fileName );
      return await fs.readFile ( filePath );
    }

    it ( 'test1.docx', async () => {
      const documentContent = await loadDocument ( 'test1.docx' );
      expect ( await findType ( tikaServer, documentContent ) ).toBe ( 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' );
      const result = await processDocument ( tikaServer, documentContent );
      expect ( cleaned ( result ) ).toEqual ( await loadExpectedResult ( 'test1.expected.html' ) );
    } );
    it ( 'test1.docx with digest', async () => {
      const documentContent = await loadDocument ( 'test1.docx' );
      let config = {...tikaServer, digest: sha256FromBuffer};
      expect ( await findType ( config, documentContent ) ).toBe ( 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' );
      const result = await processDocument ( config, documentContent );
      expect ( cleaned ( result ) ).toEqual ( await loadExpectedResult ( 'test1.sha.expected.html' ) );
    } );
    it ( 'test2.odt', async () => {
      const documentContent = await loadDocument ( 'test2.odt' );
      expect ( await findType ( tikaServer, documentContent ) ).toBe ( 'application/vnd.oasis.opendocument.text' );
      const result = await processDocument ( tikaServer, documentContent );
      expect ( cleaned ( result ) ).toEqual ( await loadExpectedResult ( 'test2.expected.html' ) );
    } );
    it ( 'test3.pdf', async () => {
      const documentContent = await loadDocument ( 'test3.pdf' );
      expect ( await findType ( tikaServer, documentContent ) ).toBe ( 'application/pdf' );
      const result = await processDocument ( tikaServer, documentContent );
      expect ( cleaned ( result ) ).toEqual ( await loadExpectedResult ( 'test3.expected.html' ) );
    } );
    it ( 'test4.rtf', async () => {
      const documentContent = await loadDocument ( 'test4.rtf' );
      expect ( await findType ( tikaServer, documentContent ) ).toBe ( 'application/rtf' );
      const result = await processDocument ( tikaServer, documentContent );
      expect ( cleaned ( result ) ).toEqual ( await loadExpectedResult ( 'test4.expected.html' ) );
    } );
    it ( 'test5.ods', async () => {
      const documentContent = await loadDocument ( 'test5.ods' );
      expect ( await findType ( tikaServer, documentContent ) ).toBe ( 'application/vnd.oasis.opendocument.spreadsheet' );
      const result = await processDocument ( tikaServer, documentContent );
      expect ( cleaned ( result ) ).toEqual ( await loadExpectedResult ( 'test5.expected.html' ) );
    } );
    it ( 'test6.xlsx', async () => {
      const documentContent = await loadDocument ( 'test6.xlsx' );
      expect ( await findType ( tikaServer, documentContent ) ).toBe ( 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' );
      const result = await processDocument ( tikaServer, documentContent );
      expect ( cleaned ( result ) ).toEqual ( await loadExpectedResult ( 'test6.expected.html' ) );
    } );

  } );
} );
