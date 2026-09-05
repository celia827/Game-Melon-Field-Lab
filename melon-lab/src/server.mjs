import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('./public/',import.meta.url);
const mime={html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',png:'image/png'};
http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const target=new URL('.'+(pathname==='/'?'/index.html':pathname),root);if(!fileURLToPath(target).startsWith(fileURLToPath(root))){res.writeHead(403).end();return;}const body=await readFile(target);res.writeHead(200,{'Content-Type':mime[target.pathname.split('.').pop()]||'application/octet-stream','Cache-Control':'no-cache'}).end(body);}catch{res.writeHead(404).end('Not found');}}).listen(4173,'127.0.0.1',()=>console.log('Melon Lab: http://127.0.0.1:4173'));
