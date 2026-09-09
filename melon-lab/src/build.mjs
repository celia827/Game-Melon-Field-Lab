import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';

const root=new URL('./',import.meta.url);
const publicDir=new URL('./public/',root);
const distDir=new URL('./dist/',root);
await mkdir(distDir,{recursive:true});
await cp(publicDir,distDir,{recursive:true});

const html=await readFile(new URL('./public/index.html',root),'utf8');
const css=await readFile(new URL('./public/style.css',root),'utf8');
const physics=await readFile(new URL('./public/physics.js',root),'utf8');
const game=await readFile(new URL('./public/game.js',root),'utf8');
const fruits=(await readFile(new URL('./public/fruits.png',root))).toString('base64');
const inlinePhysics=physics.replace(/^export /gm,'');
const inlineGame=game.replace("import {World,TYPES,MODES,BOUNDS} from './physics.js';",`const {World,TYPES,MODES,BOUNDS}=(()=>{${inlinePhysics} return {World,TYPES,MODES,BOUNDS};})();`);
const standalone=html.replace('<link rel="stylesheet" href="style.css">',`<style>${css}</style>`).replace('<script type="module" src="game.js"></script>',`<script>${inlineGame}</script>`).replaceAll('fruits.png',`data:image/png;base64,${fruits}`);
await writeFile(new URL('../瓜体实验室.html',root),standalone);
