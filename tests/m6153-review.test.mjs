import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('AppLog explicitly imports System.IO for file and directory operations',()=>{
 const source=readFileSync('desktop/AppLifecycle/AppLog.cs','utf8');
 assert.match(source,/^using System\.Diagnostics;\s*using System\.IO;\s*using System\.Text;/);
 assert.match(source,/Directory\.CreateDirectory/);
 assert.match(source,/File\.AppendAllText/);
});
