import http from 'node:http';
import worker from '../dist/worker.mjs';
const server=http.createServer(async(req,res)=>{
 try{const response=await worker.fetch(new Request('http://localhost:4173'+req.url,{method:req.method}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}
 catch(e){console.error(e);res.writeHead(500);res.end('Local preview error');}
});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
