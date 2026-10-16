// A nonmodal, optional guide. It owns no project data or playback state.
export const GUIDE_STEPS=[
 {title:'Place three bells',instruction:'Tap a bell above to hear it, then drag it into the canvas. Try three different notes.'},
 {title:'Connect them with a path',instruction:'Choose Path. Draw through your bells, then lift your finger. Your gesture becomes something you can play again.'},
 {title:'Play, then change it',instruction:'Tap the path’s play circle. Choose Move to rearrange a bell, then play the path again. What changes?'}
];
export function installStartGuide({enabled=true}={}){
 const $=id=>document.getElementById(id),guide=$('startGuide'),help=$('helpStart');
 if(!guide||!help)return;
 if(!enabled){guide.hidden=true;help.hidden=true;return;}
 let step=0,corner=0;
 const corners=['bottom-right','top-right','top-left','bottom-left'];
 function render(){
  guide.hidden=false;help.setAttribute('aria-expanded','true');document.body.dataset.guideOpen='true';
  $('guideProgress').textContent=(step+1)+' of 3 · Make a small melody';
  $('guideTitle').textContent=GUIDE_STEPS[step].title;$('guideInstruction').textContent=GUIDE_STEPS[step].instruction;
  $('nextGuide').textContent=step===2?'Finish':'Next';$('skipGuide').textContent=step===2?'Back':'Skip step';
 }
 function close(){guide.hidden=true;help.setAttribute('aria-expanded','false');delete document.body.dataset.guideOpen;help.focus({preventScroll:true});}
 help.onclick=()=>{if(!guide.hidden){close();return;}step=0;render();$('guideTitle').focus({preventScroll:true});};
 $('exitGuide').onclick=close;
 $('nextGuide').onclick=()=>{if(step===2)close();else{step++;render();}};
 $('skipGuide').onclick=()=>{step=step===2?1:step+1;render();};
 $('moveGuide').onclick=()=>{corner=(corner+1)%corners.length;guide.dataset.corner=corners[corner];};
 // Guide controls must never draw paths, delete a selection, or invoke clipboard shortcuts.
 for(const type of ['pointerdown','pointermove','pointerup','pointercancel','click','dblclick','copy','cut','paste','wheel'])guide.addEventListener(type,e=>e.stopPropagation());
 for(const type of ['keydown','copy','cut','paste'])help.addEventListener(type,e=>e.stopPropagation());
 // Installed before full-screen handling so Escape closes this focused guide first.
 window.addEventListener('keydown',e=>{
  if(guide.hidden||!guide.contains(e.target))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close();}
 },true);
 guide.addEventListener('keydown',e=>e.stopPropagation());
 document.addEventListener('melodymorph-language-change',()=>{if(!guide.hidden)render();});
 return {close};
}
