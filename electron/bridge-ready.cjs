const http = require('node:http');

// A cold start can take longer than a normal page request. Bound the whole
// response, not just idle socket time, and release every socket on timeout.
function read(url, timeout) {
  return new Promise(resolve => {
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
    const req=http.get(url,res=>{
      let body='';
      res.on('data',chunk=>{body+=chunk;if(body.length>16*1024*1024){req.destroy();finish(null);}});
      res.on('end',()=>finish({status:res.statusCode,body}));
      res.on('error',()=>finish(null));res.on('aborted',()=>finish(null));
    });
    const timer=setTimeout(()=>{req.destroy();finish(null);},timeout);
    req.on('error',()=>finish(null));
  });
}

async function waitForBridge(port,{timeoutMs=120000,requestMs=5000,intervalMs=250,alive=()=>true}={}) {
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline&&alive()){
    const probe=route=>read(`http://127.0.0.1:${port}${route}`,Math.max(1,Math.min(requestMs,deadline-Date.now())));
    const page=await probe('/');
    if(page?.status===200&&/<html[\s>]/i.test(page.body)&&Date.now()<deadline){
      const state=await probe('/api/state');
      try{if(alive()&&state?.status===200&&Array.isArray(JSON.parse(state.body).households))return true;}catch{}
    }
    const remaining=deadline-Date.now();if(remaining>0&&alive())await new Promise(resolve=>setTimeout(resolve,Math.min(intervalMs,remaining)));
  }
  return false;
}
module.exports={waitForBridge};
