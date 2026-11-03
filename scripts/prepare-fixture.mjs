import{writeFile}from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../fixtures');
const data={language:'en',segments:[{start:0,end:4.5,text:'Reading English can be simple and enjoyable.',words:[
 ['Reading',.3,.9],['English',1,1.55],['can',1.6,1.85],['be',1.9,2.12],['simple',2.2,3.0],['and',3.1,3.35],['enjoyable.',3.5,4.45]].map(([word,start,end])=>({word,start,end,score:.99}))},{start:4.7,end:9.8,text:'Each highlighted word follows the original voice.',words:[['Each',4.75,5.2],['highlighted',5.25,6.35],['word',6.4,6.9],['follows',7,7.55],['the',7.65,7.85],['original',8,8.7],['voice.',8.75,9.7]].map(([word,start,end])=>({word,start,end,score:.99}))}]};
await writeFile(path.join(dir,'demo.json'),JSON.stringify(data,null,2));console.log('Created demo.json');
