const { io } = require('socket.io-client');
const URL='http://localhost:3100'; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const NAMES=['Ava','Bo','Cy','Dot','Eli','Fin','Gus','Hana'];
const COLORS=['#FF5C49','#34D399','#FBBF24','#60A5FA','#F472B6','#A78BFA','#22D3EE','#FB923C'];
const TYPES=['duck','penguin','pelican'];
function mk(name,token,color){ const s=io(URL); const st={id:null,sock:s}; s.on('ctrl:joined',d=>st.id=d.id);
  return new Promise(r=>{ s.on('connect',()=>s.emit('ctrl:join',{name,token,color,code:'FOWL'})); const iv=setInterval(()=>{ if(st.id){clearInterval(iv);r(st);} },30); }); }
(async()=>{
  const players=[];
  for(let i=0;i<8;i++){ players.push(await mk(NAMES[i],'fw-'+i,COLORS[i])); await sleep(60); }
  await sleep(300);
  players.forEach((p,i)=> p.sock.emit('ctrl:char',{type:TYPES[i%3]}));
  await sleep(300);
  players[0].sock.emit('ctrl:start',{}); players[0].sock.emit('ctrl:rematch',{});
  require('fs').writeFileSync('/tmp/eight.out','8 CPU players in: '+players.map(p=>p.id).join(',')+'\n');
  await sleep(600000);   // hold the connections; the TV's AI drives them
  process.exit(0);
})();
