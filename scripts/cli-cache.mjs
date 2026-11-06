import {mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';

// Every invocation owns its media, browser bundle and intermediate output.
// Retained job directories are intentional: CLI render diagnostics remain available.
export async function createCliTaskCacheDir(cacheRoot){
 await mkdir(cacheRoot,{recursive:true});
 return mkdtemp(path.join(cacheRoot,'job-'));
}
