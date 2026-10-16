// Handedness belongs to this browser, not to a composition or its undo history.
export function installToolRail({preferenceKey}){
 const body=document.body,rail=document.querySelector('.canvas-tools'),toggle=document.getElementById('leftHanded'),hint=document.getElementById('toolHint');
 try{toggle.checked=localStorage.getItem(preferenceKey)==='true';}catch{}
 const apply=()=>{body.dataset.handedness=toggle.checked?'left':'right';hint.hidden=true;};
 apply();toggle.onchange=()=>{apply();try{localStorage.setItem(preferenceKey,String(toggle.checked));}catch{}};
 function show(button){
  if(!button||button.disabled)return;
  const bounds=button.getBoundingClientRect(),frame=document.querySelector('.instrument').getBoundingClientRect();
  hint.textContent=button.getAttribute('aria-label')||button.textContent;hint.hidden=false;
  hint.style.top=Math.max(4,Math.min(frame.height-58,bounds.top-frame.top))+'px';
 }
 rail.addEventListener('pointerover',e=>{if(e.pointerType!=='touch')show(e.target.closest('button'));});
 rail.addEventListener('pointerleave',()=>hint.hidden=true);
 rail.addEventListener('pointerdown',()=>hint.hidden=true);
 rail.addEventListener('focusin',e=>show(e.target.closest('button')));
 rail.addEventListener('focusout',()=>hint.hidden=true);
 rail.addEventListener('scroll',()=>hint.hidden=true,{passive:true,capture:true});
 document.addEventListener('melodymorph-language-change',()=>hint.hidden=true);
 // The phone header can wrap; keep the drawer below its actual bottom edge.
 const updatePanel=()=>body.style.setProperty('--settings-top',Math.ceil(document.querySelector('header').getBoundingClientRect().bottom+6)+'px');
 new ResizeObserver(updatePanel).observe(document.querySelector('header'));updatePanel();
}
