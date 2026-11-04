import {ensureBrowser} from '@remotion/renderer';
try {await ensureBrowser({logLevel:'error'});console.log('Remotion browser is ready');}
catch(error){console.error(error);process.exitCode=1;}
