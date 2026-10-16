import { GuidanceSpeaker } from "./speech.mjs";

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const video = $("#cameraVideo"), canvas = $("#videoFeed"), ctx = canvas.getContext("2d");
const input = document.createElement("canvas"), imageCtx = input.getContext("2d", { willReadFrequently: true });
const targets = [
  ["Lip peak", [0, 37, 267, 13]],
  ["Upper lip", [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291]],
  ["Right corner", [291, 375, 321, 308]],
  ["Lower lip", [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291]],
  ["Left corner", [61, 146, 91, 78]]
];
const lip = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const arrows = {LEFT:"←",RIGHT:"→",UP:"↑",DOWN:"↓",UP_LEFT:"↖",UP_RIGHT:"↗",DOWN_LEFT:"↙",DOWN_RIGHT:"↘",HOLD:"·"};
const chinese = {LEFT:"左",RIGHT:"右",UP:"上",DOWN:"下",UP_LEFT:"左上",UP_RIGHT:"右上",DOWN_LEFT:"左下",DOWN_RIGHT:"右下"};
let detector, stream, running = false, frameId, lastFrame = 0, lastVideoTime = -1, fps = 0;
let targetIndex = 0, stable = 0, previous, mousePoint, mode = "lipstick", sampledColor, sampleNext = false;
let starting = false, session = 0;
const speaker = new GuidanceSpeaker({onStatus(message, enabled, available) {
  $("#speechStatus").textContent = message;
  $("#toggleSpeech").textContent = enabled ? "关闭语音" : "开启语音";
  $("#toggleSpeech").setAttribute("aria-pressed", String(enabled));
  $("#toggleSpeech").disabled = $("#testSpeech").disabled = !available;
}});

function show(code, title, message, direction = "—", distance = null) {
  $("#statusCode").textContent = code;
  $("#cameraState").textContent = title.toUpperCase();
  $("#guidanceTitle").textContent = title;
  $("#guidanceMessage").textContent = message;
  $("#directionValue").textContent = direction;
  $("#directionArrow").textContent = arrows[direction] || "—";
  $("#distanceValue").textContent = distance == null ? "—" : `${Math.round(distance)}px`;
  $("#distanceMeter").style.width = distance == null ? "0%" : `${Math.min(100, distance / 2)}%`;
  $("#fpsValue").textContent = fps ? `${fps} fps` : "—";
  $("#fpsMeter").style.width = fps ? `${Math.min(100, fps * 3)}%` : "0%";
  $("#targetValue").textContent = targets[targetIndex][0];
  $("#targetProgress").textContent = `Region ${targetIndex + 1} / 5`;
  $("#footerStatus").textContent = running ? `${fps} FPS · processing on this device` : "No active session";
}
function controls() {
  $("#startCamera").disabled = running || starting;
  $("#stopCamera").disabled = !running && !starting;
  $$(".control-button, .mode-button").forEach(b => b.disabled = !running);
  $("#servicePill").classList.toggle("is-online", running);
  $("#serviceText").textContent = running ? "Camera live" : "Browser ready";
  canvas.classList.toggle("is-visible", running);
  $("#videoPlaceholder").classList.toggle("is-hidden", running);
}
async function start() {
  if (running || starting) return;
  const activeSession = ++session;
  starting = true; controls();
  if (speaker.enabled) speaker.test();
  show("STARTING", "Preparing camera", "Allow camera access when your browser asks. Video stays on this device.");
  try {
    if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error("Camera access requires HTTPS and a supported browser.");
    const acquired = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:"user",width:{ideal:640},height:{ideal:480}}});
    if (activeSession !== session) { acquired.getTracks().forEach(track => track.stop()); return; }
    stream = acquired;
    video.srcObject = stream;
    await video.play();
    if (activeSession !== session) return;
    canvas.width = input.width = video.videoWidth || 640;
    canvas.height = input.height = video.videoHeight || 480;
    if (!detector) {
      show("LOADING_MODEL", "Loading vision model", "首次加载需要下载视觉模型，请稍候。失败后可点击 Start Camera 重试。");
      const { FaceLandmarker, FilesetResolver } = await import("./vendor/package/vision_bundle.mjs");
      if (activeSession !== session) return;
      const files = await FilesetResolver.forVisionTasks("./vendor/package/wasm");
      if (activeSession !== session) return;
      const loaded = await FaceLandmarker.createFromOptions(files, {
        baseOptions:{modelAssetPath:"./vendor/face_landmarker.task",delegate:"CPU"},
        runningMode:"VIDEO", numFaces:2, minFaceDetectionConfidence:0.5,
        minFacePresenceConfidence:0.5, minTrackingConfidence:0.55
      });
      if (activeSession !== session) { loaded.close(); return; }
      detector = loaded;
    }
    starting = false; running = true; controls(); lastFrame = 0; lastVideoTime = -1;
    show("NO_FACE", "Find your face", "Keep one face centered in the frame.");
    frameId = requestAnimationFrame(frame);
  } catch (error) {
    if (activeSession !== session) return;
    const loadingModel = $("#statusCode").textContent === "LOADING_MODEL";
    stop();
    const message = error.name === "NotAllowedError" ? "Camera permission was denied. Allow it in browser settings and try again." :
      error.name === "NotFoundError" ? "No camera was found on this device." : error.message;
    show(loadingModel ? "MODEL_UNAVAILABLE" : "CAMERA_UNAVAILABLE", loadingModel ? "Model unavailable" : "Camera unavailable", `${message} 请检查网络及权限后点击 Start Camera 重试。`);
  } finally { if (activeSession === session) { starting = false; controls(); } }
}
function stop() {
  session++; starting = false; running = false; cancelAnimationFrame(frameId);
  stream?.getTracks().forEach(track => track.stop());
  stream = undefined; video.srcObject = null;
  speaker.clear(); previous = undefined; mousePoint = undefined; sampleNext = false; stable = 0; controls();
  show("IDLE", "Camera is ready", "Press Start Camera and allow access to begin.");
}
function at(face, i) { return {x:face[i].x * canvas.width,y:face[i].y * canvas.height}; }
function average(face, indices) {
  const points = indices.map(i => at(face, i));
  return {x:points.reduce((s,p) => s+p.x,0)/points.length,y:points.reduce((s,p) => s+p.y,0)/points.length};
}
function outline(face) {
  const path = new Path2D();
  lip.forEach((i,n) => { const p=at(face,i); if(n)path.lineTo(p.x,p.y);else path.moveTo(p.x,p.y); });
  path.closePath(); ctx.strokeStyle="#9bf0d5"; ctx.lineWidth=2; ctx.stroke(path);
  return path;
}
function matches(r,g,b) {
  if (Math.max(r,g,b)-Math.min(r,g,b)<35 || Math.max(r,g,b)<65) return false;
  if (sampledColor) {
    const [cr,cg,cb]=sampledColor, n=r+g+b, cn=cr+cg+cb;
    return Math.hypot(r/n-cr/cn,g/n-cg/cn,b/n-cb/cn)<0.16;
  }
  return r>g*1.35 && r>b*1.07 && (b>g*0.65 || r>b*1.5);
}
function lipstick(face,target,path) {
  const mouth=[61,291,0,17].map(i=>at(face,i));
  const xs=mouth.map(p=>p.x),ys=mouth.map(p=>p.y);
  const mx=Math.max(...xs)-Math.min(...xs),my=Math.max(...ys)-Math.min(...ys);
  const x1=Math.max(0,Math.floor(Math.min(...xs)-Math.max(40,mx*.8)));
  const y1=Math.max(0,Math.floor(Math.min(...ys)-Math.max(40,my*1.6)));
  const x2=Math.min(canvas.width,Math.ceil(Math.max(...xs)+Math.max(40,mx*.8)));
  const y2=Math.min(canvas.height,Math.ceil(Math.max(...ys)+Math.max(40,my*1.6)));
  if(x2<=x1||y2<=y1)return null;
  const image=imageCtx.getImageData(x1,y1,x2-x1,y2-y1),step=3;
  const cols=Math.ceil(image.width/step),rows=Math.ceil(image.height/step),mask=new Uint8Array(cols*rows);
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const px=Math.min(image.width-1,col*step),py=Math.min(image.height-1,row*step);
    if(ctx.isPointInPath(path,x1+px,y1+py))continue;
    const k=(py*image.width+px)*4;
    if(matches(image.data[k],image.data[k+1],image.data[k+2]))mask[row*cols+col]=1;
  }
  let best=null;
  for(let i=0;i<mask.length;i++){
    if(!mask[i])continue;
    const queue=[i];mask[i]=0;let tip=null,near=Infinity;
    for(let head=0;head<queue.length;head++){
      const cell=queue[head],col=cell%cols,row=Math.floor(cell/cols);
      const x=x1+col*step,y=y1+row*step,d=(x-target.x)**2+(y-target.y)**2;
      if(d<near){near=d;tip={x,y};}
      for(const j of [col>0?cell-1:-1,col<cols-1?cell+1:-1,row>0?cell-cols:-1,row<rows-1?cell+cols:-1])
        if(j>=0&&mask[j]){mask[j]=0;queue.push(j);}
    }
    if(queue.length>=6&&(!best||queue.length>best.size))best={size:queue.length,tip};
  }
  return best?.tip||null;
}
function guidance(current,target) {
  const dx=target.x-current.x,dy=target.y-current.y,distance=Math.hypot(dx,dy);
  const tolerance=Math.max(12,canvas.width*18/640);
  const h=Math.abs(dx)>tolerance?(dx>0?"RIGHT":"LEFT"):"";
  const v=Math.abs(dy)>tolerance?(dy>0?"DOWN":"UP"):"";
  const direction=v&&h?`${v}_${h}`:v||h||"HOLD";
  const still=previous&&Math.hypot(current.x-previous.x,current.y-previous.y)<=Math.max(5,canvas.width*5/640);
  stable=distance<=tolerance?(still?stable+1:1):0;previous=current;
  const name=targets[targetIndex][0];
  if(stable>=8){
    targetIndex=(targetIndex+1)%5;stable=0;previous=undefined;
    show("NEXT_REGION","Next region",`${name} is done. Moving to the next region.`,direction,distance);
    speaker.update({action:"NEXT_REGION",direction:"HOLD",target_region:targetIndex,text:"已到位，进入下一个区域"});
  }else if(distance<=tolerance){
    show("HOLD","Hold position",`Close to ${name}. Hold steady.`,direction,distance);
    speaker.update({action:"MOVE",direction:"HOLD",target_region:targetIndex,text:"保持当前位置"});
  }
  else{show("TRACKING",`Move ${direction.toLowerCase().replace("_"," ")}`,`Move toward ${name}.`,direction,distance);speaker.update({action:"MOVE",direction,target_region:targetIndex,text:`请向${chinese[direction]}移动`});}
  ctx.strokeStyle="#ffb36f";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(current.x,current.y);ctx.lineTo(target.x,target.y);ctx.stroke();
  ctx.fillStyle="#ff6a58";ctx.beginPath();ctx.arc(current.x,current.y,8,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle="#9bf0d5";ctx.beginPath();ctx.arc(target.x,target.y,11,0,Math.PI*2);ctx.stroke();
}
function frame(now) {
  if(!running)return;
  frameId=requestAnimationFrame(frame);
  if(now-lastFrame<90||video.readyState<2||video.currentTime===lastVideoTime)return;
  fps=lastFrame?Math.round(1000/(now-lastFrame)):0;lastFrame=now;lastVideoTime=video.currentTime;
  imageCtx.save();imageCtx.translate(input.width,0);imageCtx.scale(-1,1);
  imageCtx.drawImage(video,0,0,input.width,input.height);imageCtx.restore();
  ctx.drawImage(input,0,0);
  try{
    const faces=detector.detectForVideo(input,now).faceLandmarks||[];
    if(faces.length!==1){speaker.clear();previous=undefined;stable=0;show(faces.length?"MULTIPLE_FACES":"NO_FACE",faces.length?"One face at a time":"Find your face",faces.length?"Keep only one face in the frame.":"Keep your face centered in the frame.");return;}
    const face=faces[0],path=outline(face),target=average(face,targets[targetIndex][1]);
    const current=mode==="mouse"?mousePoint:lipstick(face,target,path);
    if(!current){speaker.clear();previous=undefined;stable=0;show("NO_TRACKED_POINT","Show the lipstick",mode==="mouse"?"Move the pointer over the video to mark the lipstick tip.":"Hold a saturated red or pink lipstick near your lips.");return;}
    guidance(current,target);
  }catch(error){stop();show("PROCESSING_ERROR","Vision stopped",error.message||"Could not process camera frames.");}
}
function pointer(event) {
  const rect=canvas.getBoundingClientRect(),scale=Math.min(rect.width/canvas.width,rect.height/canvas.height);
  const left=rect.left+(rect.width-canvas.width*scale)/2,top=rect.top+(rect.height-canvas.height*scale)/2;
  return{x:(event.clientX-left)/scale,y:(event.clientY-top)/scale};
}
$("#videoWrap").addEventListener("pointermove",event=>{if(running&&mode==="mouse")mousePoint=pointer(event);});
$("#videoWrap").addEventListener("click",event=>{
  if(!running||!sampleNext)return;
  const p=pointer(event),x=Math.round(p.x),y=Math.round(p.y);
  if(x<2||y<2||x>=input.width-2||y>=input.height-2)return;
  const data=imageCtx.getImageData(x-2,y-2,5,5).data,rgb=[0,0,0];
  for(let i=0;i<data.length;i+=4)for(let j=0;j<3;j++)rgb[j]+=data[i+j];
  sampledColor=rgb.map(v=>v/25);sampleNext=false;
  $("#modeHint").textContent="Color sampled. Hold the lipstick near your lips.";
});
$("#startCamera").addEventListener("click",start);
$("#stopCamera").addEventListener("click",stop);
$("#nextTarget").addEventListener("click",()=>{speaker.clear();targetIndex=(targetIndex+1)%5;stable=0;previous=undefined;show("NEXT_REGION","Next region",`Now guide toward ${targets[targetIndex][0]}.`);});
$("#calibrate").addEventListener("click",()=>{speaker.clear();mode="lipstick";$$(".mode-button").forEach(b=>b.classList.toggle("is-selected",b.dataset.mode===mode));sampleNext=true;$("#modeHint").textContent="Tap the lipstick color in the camera picture to sample it.";});
$("#resetSession").addEventListener("click",()=>{speaker.clear();mousePoint=undefined;sampleNext=false;targetIndex=0;stable=0;previous=undefined;sampledColor=undefined;show("IDLE","Session reset","Start from the lip peak.");});
$("#saveScreenshot").addEventListener("click",()=>{const a=document.createElement("a");a.download="modiassist-frame.png";a.href=canvas.toDataURL("image/png");a.click();});
$$(".mode-button").forEach(button=>button.addEventListener("click",()=>{
  speaker.clear(); sampleNext=false; mode=button.dataset.mode;mousePoint=undefined;previous=undefined;stable=0;
  $$(".mode-button").forEach(b=>b.classList.toggle("is-selected",b===button));
  $("#modeHint").textContent=mode==="mouse"?"Move the pointer over the video to simulate the lipstick tip.":"Hold a saturated red or pink lipstick near your lips.";
  $("#pointerHelp").textContent=mode==="mouse"?"Mouse mode: move over the lipstick tip":"Lipstick mode: show the product near your lips";
}));
$("#testSpeech").addEventListener("click",()=>speaker.test());
$("#toggleSpeech").addEventListener("click",()=>speaker.setEnabled(!speaker.enabled));
document.addEventListener("visibilitychange",()=>{if(document.hidden)stop();});
window.addEventListener("pagehide",stop);
controls();show("IDLE","Camera is ready","Press Start Camera and allow access to begin.");
