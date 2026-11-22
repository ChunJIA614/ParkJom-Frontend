// Contract-based local status mock. Control routes exist only for test setup.
const http = require('http');
const uuid = '7d9f2c41-8a63-4b72-9e15-6c2a0f84b731';
const seed = () => ({ position: 'LOCKED', status: 200, delayMs: 500, sensorStatus: 'ok', distanceCm: 75, heartbeatStatus: 'online', receivedAt: new Date(Date.now()-3000).toISOString() });
let scenario=seed(); const requests=[];
http.createServer(async (req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Authorization, Content-Type, Cache-Control, Pragma','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
  if(req.method==='OPTIONS')return send(204,null);
  if(req.method==='POST'&&url.pathname==='/__scenario'){
    let body='';if(!req.body){for await(const chunk of req)body+=chunk;}
    const data=typeof req.body==='string'?JSON.parse(req.body):req.body||JSON.parse(body||'{}');scenario={...seed(),...data};requests.length=0;return send(200,scenario);
  }
  if(req.method==='GET'&&url.pathname==='/__requests')return send(200,requests);
  if(req.method==='GET'&&url.pathname==='/api/iot/status'){
    requests.push({method:req.method,path:url.pathname+url.search});
    if(req.headers.authorization!=='Bearer fixture-token')return send(401,{success:false,message:'Sign in to view status.'});
    const keys=[...url.searchParams.keys()];if(keys.length!==1||!['bookingId','deviceUuid','parkingSpotId'].includes(keys[0]))return send(400,{success:false,message:'Choose exactly one selector.'});
    if(url.searchParams.get('bookingId')!=='42'&&url.searchParams.get('deviceUuid')!==uuid&&url.searchParams.get('parkingSpotId')!=='24')return send(404,{success:false,message:'Target not found.'});
    const value={...scenario};await new Promise(resolve=>setTimeout(resolve,value.delayMs));
    if(value.status!==200)return send(value.status,{success:false,errorCode:'STATUS_SERVICE_UNAVAILABLE',message:'Status service unavailable. Try again.'});
    return send(200,{code:200,success:true,message:value.receivedAt===null?'No device reading has been recorded yet.':'Latest logged bollard status retrieved.',data:{deviceUuid:uuid,bookingId:url.searchParams.has('bookingId')?42:null,heartbeatStatus:value.heartbeatStatus,lastHeartbeatAt:value.receivedAt,checkedAt:new Date().toISOString(),offlineAfterSeconds:90,distanceCm:value.distanceCm,sensorStatus:value.sensorStatus,bollardPosition:value.position,receivedAt:value.receivedAt,parkingSpot:{parkingSpotId:24,parkingLabel:'A-24',propertyId:3,propertyName:'Fixture'}}});
  }
  send(501,{success:false,message:'Endpoint outside this stored-status simulation.'});
}).listen(process.env.PORT||4500);
