// Fullscreen is progressive enhancement. The fixed viewport layout also works
// where element fullscreen is unavailable (including iPhone browser contexts).
export function installCanvasView({windowObject=window,documentObject=document,onLayout=()=>{}}={}){
 const w=windowObject,d=documentObject,root=d.documentElement,body=d.body;
 const button=d.getElementById('canvasView'),label=d.getElementById('canvasViewLabel'),tray=d.getElementById('paletteToggle'),menu=d.getElementById('workspaceMenu');
 let saved=null,nativeEntered=false,lastSize='';
 const fullscreenElement=()=>d.fullscreenElement||d.webkitFullscreenElement;
 const nativeExit=()=>{try{return Promise.resolve((d.exitFullscreen||d.webkitExitFullscreen)?.call(d)).catch(()=>{});}catch{return Promise.resolve();}};
 function sync(){
  const active=!!saved;
  button.setAttribute('aria-pressed',String(active));
  const text=active?(nativeEntered?'Exit fullscreen':'Exit expanded view'):'Expand canvas';
  button.setAttribute('aria-label',text);
  button.title=active?(nativeEntered?'Browser fullscreen':'Canvas expanded within this page'):'Expand canvas; browser fullscreen is used when available';label.textContent=text;
  const visible=active&&body.classList.contains('show-palette');
  tray.hidden=!active;tray.setAttribute('aria-pressed',String(visible));
  tray.setAttribute('aria-expanded',String(visible));
  tray.setAttribute('aria-controls','paletteViewport');
  tray.setAttribute('aria-label',visible?'Hide bells':'Show bells');
  tray.textContent=visible?'Hide bells':'Bells';
  body.dataset.fullscreen=active?(nativeEntered?'native':'viewport'):'off';
 }
 function resize(){
  // Do not resize the layout to cancel browser accessibility magnification.
  const v=w.visualViewport,normalScale=!v||Math.abs(v.scale-1)<.01;
  const height=normalScale&&v?v.height:w.innerHeight;
  const size=`${w.innerWidth}:${Math.round(height)}`;
  if(saved)body.style.setProperty('--canvas-height',`${height}px`);
  if(size!==lastSize){lastSize=size;onLayout();}
 }
 function restore(){
  if(!saved)return;
  const previous=saved;saved=null;nativeEntered=false;
  onLayout();body.classList.remove('canvas-fullscreen','show-palette');root.classList.remove('canvas-locked');
  if(previous.height)body.style.setProperty('--canvas-height',previous.height,previous.heightPriority);else body.style.removeProperty('--canvas-height');
  menu.open=previous.menuOpen;sync();
  w.scrollTo({left:previous.x,top:previous.y,behavior:'instant'});
  previous.focus?.focus?.({preventScroll:true});
  d.getElementById('paletteViewport').scrollLeft=previous.paletteScroll;
 }
 function enter(){
  if(saved)return;
  saved={x:w.scrollX,y:w.scrollY,focus:d.activeElement,menuOpen:menu.open,paletteScroll:d.getElementById('paletteViewport').scrollLeft,height:body.style.getPropertyValue('--canvas-height'),heightPriority:body.style.getPropertyPriority('--canvas-height')};
  onLayout();menu.open=false;body.classList.add('canvas-fullscreen','show-palette');root.classList.add('canvas-locked');resize();sync();
  button.focus({preventScroll:true});
  const request=root.requestFullscreen||root.webkitRequestFullscreen;
  if(request&&d.fullscreenEnabled!==false){
   try{Promise.resolve(request.call(root)).then(()=>{
    if(!saved){if(fullscreenElement()===root)void nativeExit();return;}
    nativeEntered=fullscreenElement()===root;resize();sync();
   }).catch(()=>{if(saved){nativeEntered=false;sync();}});}catch{/* Keep the viewport fallback. */}
  }
 }
 function exit(){const ownsNative=fullscreenElement()===root;restore();if(ownsNative)void nativeExit();}
 function fullscreenChanged(){
  if(fullscreenElement()===root){if(saved){nativeEntered=true;resize();sync();}else void nativeExit();}
  else if(nativeEntered)restore();
 }
 button.onclick=()=>saved?exit():enter();
 tray.onclick=()=>{if(!saved)return;onLayout();body.classList.toggle('show-palette');sync();};
 d.addEventListener('fullscreenchange',fullscreenChanged);d.addEventListener('webkitfullscreenchange',fullscreenChanged);
 w.addEventListener('resize',resize);w.visualViewport?.addEventListener('resize',resize);
 // Escape exits the view without invoking the application's stop-audio shortcut.
 w.addEventListener('keydown',e=>{if(e.key!=='Escape'||!saved)return;e.preventDefault();e.stopImmediatePropagation();if(menu.open){menu.open=false;menu.querySelector('summary').focus();}else exit();},true);
 resize();sync();
 return {enter,exit,get active(){return !!saved;}};
}
