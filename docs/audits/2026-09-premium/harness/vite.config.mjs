import { defineConfig } from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
const base=path.dirname(new URL(import.meta.url).pathname);
const root=base+'/export';
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.json':'application/json'};
export default defineConfig({server:{allowedHosts:['terminal.local']},plugins:[{name:'unchanged-expo-export',configureServer(server){server.middlewares.use(async(req,res,next)=>{
try {const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
let file=pathname==='/__audit'?base+'/audit-frame.html':pathname==='/__axe.js'?base+'/node_modules/axe-core/axe.min.js':pathname.startsWith('/__directions/')?base+'/directions/'+pathname.slice('/__directions/'.length):path.join(root,pathname);
if(pathname==='/__chat-fixture') {
 res.writeHead(200, {'content-type':'text/event-stream','x-vercel-ai-ui-message-stream':'v1','cache-control':'no-store'});
 const send=data=>res.write('data: '+JSON.stringify(data)+'\n\n');
 send({type:'start',messageId:'fixture-answer'});
 const timers=[];
 timers.push(setTimeout(()=>send({type:'reasoning-start',id:'reason'}),400));
 timers.push(setTimeout(()=>send({type:'reasoning-delta',id:'reason',delta:'Vérification visuelle locale.'}),500));
 timers.push(setTimeout(()=>send({type:'reasoning-end',id:'reason'}),2200));
 const body='Texte de vérification du rendu. Aucun contenu médical.\n\nUn second paragraphe permet de vérifier que le premier reste à sa place pendant l’arrivée des fragments. Le défilement doit rester sous votre contrôle.\n\n| Colonne A | Colonne B |\n|---|---|\n| Texte de test | Valeur de test |\n\nUne liste de vérification :\n- Premier élément\n- Second élément\n\n'+Array.from({length:8},(_,i)=>'Paragraphe de test '+(i+1)+'. La mise en page des blocs déjà lus reste stable. Ce texte sert uniquement à mesurer le rendu du navigateur.\n\n').join('');
 timers.push(setTimeout(()=>send({type:'text-start',id:'body'}),2300));
 const chunks=body.match(/[\s\S]{1,14}/g)||[];
 chunks.forEach((delta,i)=>timers.push(setTimeout(()=>send({type:'text-delta',id:'body',delta}),2400+i*90)));
 timers.push(setTimeout(()=>{send({type:'text-end',id:'body'});send({type:'finish',finishReason:'stop'});res.end('data: [DONE]\n\n');},2500+chunks.length*90));
 res.on('close',()=>timers.forEach(clearTimeout));return;
}
if(pathname.startsWith('/api/')){res.writeHead(503,{'content-type':'application/json'});res.end('{"error":"audit_static_export_no_api"}');return;}
try{if((await fs.stat(file)).isDirectory())file=path.join(file,'index.html');}catch{file=path.join(root,'404.html');}
let bytes=await fs.readFile(file);
if (path.extname(file)==='.html' && !pathname.startsWith('/__')) {
 const instrumentation=`<script>(function(){
 if(!parent.document.querySelector('#fixture')?.checked)return;
 const reduced=parent.document.querySelector('#reduced')?.checked;
 const match=window.matchMedia.bind(window); if(reduced){window.matchMedia=q=>q.includes('prefers-reduced-motion')?{matches:true,media:q,addEventListener(){},removeEventListener(){}}:match(q);}
 const originalFetch=window.fetch.bind(window);window.fetch=(input,init)=>{const url=typeof input==='string'?input:input.url;return originalFetch(url==='/api/chat'?'/__chat-fixture':input,init);};
 // Fixture invitée strictement locale, sans requête API du produit ni session factice.
 localStorage.removeItem('medinfo.guest_message_used');
 let start=0,firstStatus=null,firstStop=null,firstText=null,stopMissing=0,completedMoves=0,samples=0;
 const positions=new Map();const movements=[];let shifts=0,streamShifts=0;
 function metric(){const ring=document.querySelector('[role=status]');const stop=document.querySelector('[aria-label="Arrêter la génération"]');const first=document.querySelector('[data-testid="assistant-message"]');const now=performance.now();if(start&&ring&&firstStatus===null)firstStatus=now-start;if(start&&stop&&firstStop===null)firstStop=now-start;if(start&&first&&firstText===null)firstText=now-start;
 if(start&&firstStop!==null&&document.body.textContent.includes('Texte de vérification')&&!document.querySelector('[data-testid="response-actions"]')&&!stop)stopMissing++;
 document.querySelectorAll('[data-testid="completed-answer-block"]').forEach(e=>{const parentScroll=e.closest('[data-testid="chat-thread"]');const y=e.getBoundingClientRect().y+(parentScroll?.scrollTop||0);const h=e.getBoundingClientRect().height;const previous=positions.get(e);if(previous&&(Math.abs(previous.y-y)>.5||Math.abs(previous.h-h)>.5)){completedMoves++;if(movements.length<20)movements.push({dy:y-previous.y,dh:h-previous.h,done:!!document.querySelector('[data-testid="response-actions"]'),text:e.textContent.slice(0,60)});}positions.set(e,{y,h});});samples++;
 parent.document.querySelector('#stream-report').textContent=JSON.stringify({fixture:true,reducedMotionSimulated:!!reduced,firstStatusMs:firstStatus,stopMs:firstStop,firstTextMs:firstText,stopMissing,completedMoves,movements,closedBlocks:positions.size,samples,rawLayoutShift:shifts,streamLayoutShift:streamShifts},null,2);}
 document.addEventListener('click',e=>{if(e.target.closest('[aria-label="Envoyer le message"]')){start=performance.now();requestAnimationFrame(metric);}},true);
 new MutationObserver(()=>{if(start)requestAnimationFrame(metric);}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
 try{new PerformanceObserver(list=>{if(start)for(const e of list.getEntries()){shifts+=e.value;if(firstText!==null)streamShifts+=e.value;}}).observe({type:'layout-shift',buffered:false});}catch{}
 if(reduced)document.addEventListener('DOMContentLoaded',()=>{const style=document.createElement('style');style.textContent='*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}';document.head.append(style);});
})();<\/script>`;
 bytes=Buffer.from(bytes.toString().replace('<head>','<head>'+instrumentation));
}
res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(bytes);
}catch(e){next(e);}
});}}]});