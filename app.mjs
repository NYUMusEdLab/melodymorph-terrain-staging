import {installWorkshopAdapter} from './workshop-adapter.mjs';
installWorkshopAdapter();
import {activityPreviewMode,memoryStorage,installActivityPlayer} from './activity-player.mjs';
import {installStartGuide} from './start-guide.mjs';
import {installTerrainGallery,showTerrainSave} from './terrain-gallery.mjs';
import {installToolRail} from './tool-rail.mjs';
import {installPersistenceGuard} from './persistence-guard.mjs';
import {LandscapeLibrary} from './landscape-library.mjs';
import {installCanvasView} from './canvas-view.mjs';
import {pathState,advancePathNetwork,isLoopPath} from './path-network.mjs';
import {installLanguage} from './language.mjs';
import {TouchNavigator} from './gestures.mjs';
import {blank,study,validate,noteName,color,clone,eventOf,normalizeCapture,INK_COLORS,strokePoints} from './model.mjs';
import {selectionKeys,selectionFor,selectionSize,itemsInBox,shiftSelection,copySelection,canTranspose,transposeNotes} from './selection.mjs';
import {Sound} from './audio.mjs';
import {reportActivity} from './activity.mjs';
import {pathHits} from './paths.mjs';
import {paletteKeys,paletteLayout,paletteIntent} from './palette.mjs';
import {TONICS,jianpuMarkup,jianpuDescription} from './notation.mjs';
let paletteGeometry=null,paletteCentered=false;
let selectedKeys=new Set(),clipboardSignature='',pasteCount=0;
const activePaths=new Map(),bellElements=new Map(),pathButtons=new Map(),pathHeads=new Map(),lineElements=new Map(),bellModels=new Map(),flashTimers=new Map();let pathFrame=null,pathEpoch=0;
const $=id=>document.getElementById(id), STORE='melodymorph-workshop-landscape-v1';
let silentEdit=false;
let inkColor=INK_COLORS[0],inkWidth=3;
let project=blank(),selected=null,timbre='piano',mode='play',history=[],future=[],capture=null,gesture=null,saveTimer;
const previewActivity=activityPreviewMode();
const library=new LandscapeLibrary({storage:previewActivity?memoryStorage():{getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)},key:STORE+':library-v1',legacyKey:STORE});
project=library.current;
const sound=new Sound((e,at,id)=>{if(capture){if(capture.events.length>=capture.limit||at-capture.started>600){finishRecording();status('Recording limit reached; the phrase was kept.',true);}else capture.events.push({...e,time:at});}flash(id);const el=bellElements.get(id);if(el?.classList.contains('recorder'))el.querySelectorAll('circle').forEach(c=>c.style.opacity=Number(c.dataset.time)<=e.time?1:.15);},id=>{bellElements.get(id)?.classList.remove('playing');const el=bellElements.get(id);el?.querySelectorAll('circle').forEach(c=>c.style.opacity=1);},{onSampleStatus:sampleStatus});
function status(message,error=false){$('saveStatus').textContent=message;$('saveStatus').classList.toggle('toast',error);}
function rememberWorkspace(){project.workspace={timbre,pianoKeys:$('pianoOverlay').checked,inkColor,inkWidth};}
function recordingPending(){ $('libraryState').hidden=false;document.body.dataset.saved='false';status('Recording not yet saved — finish the phrase before leaving.',true); }
function saveFeedback(result){
 const saved=result.ok&&!capture;$('libraryState').hidden=saved;document.body.dataset.saved=String(saved);$('recoveryExport').hidden=!library.hasRecoveryData;
 const errors={unreadable:'The saved library could not be read. Stored data was left untouched. Export this canvas and any recovery data. To keep working, import the landscape in another browser. Reloading alone will not repair damaged data.',conflict:'Another tab changed this library. Export your canvas before reloading to avoid overwriting that work.',full:'This library is full. Export your current landscape before starting elsewhere.',invalid:'This landscape could not be saved. Keep this page open and export a backup.',storage:'Not saved. Browser storage is unavailable or full. Your canvas is still open; export a backup or retry Save.',missing:'That landscape is no longer available.'};
 if(result.ok&&capture)recordingPending();else status(result.ok?'Saved on this browser.':errors[result.reason]||errors.storage,!result.ok);renderLibrary();return result.ok;
}
function persist(){clearTimeout(saveTimer);rememberWorkspace();return saveFeedback(library.save(project));}
function renderLibrary(){
 const list=$('landscapeList');if(!list)return;const focused=document.activeElement?.dataset.landscapeId;list.replaceChildren();
 for(const entry of library.entries){
  const row=document.createElement('div');row.setAttribute('role','listitem');const button=document.createElement('button');button.type='button';button.dataset.landscapeId=entry.id;button.setAttribute('aria-current',String(entry.active));
  const title=document.createElement('span');title.className='landscape-name';title.dataset.noTranslate='';title.textContent=entry.title||'Untitled';
  const detail=document.createElement('small');detail.textContent=`${entry.bells} bells · ${entry.paths} paths`;
  const state=document.createElement('span');state.className='landscape-open';state.textContent=entry.active?'Current':'Open';
  button.append(title,detail,state);button.onclick=()=>{if(entry.active)return;stop();rememberWorkspace();const result=library.open(project,entry.id);if(saveFeedback(result))loadLandscape(result.project);};row.append(button);list.append(row);if(focused===entry.id)button.focus({preventScroll:true});
 }
}
function applyWorkspace(){
 const w=project.workspace;timbre=w.timbre==='bowed'?'pluck':w.timbre;inkColor=w.inkColor;inkWidth=w.inkWidth;$('pianoOverlay').checked=w.pianoKeys;$('paletteViewport').classList.toggle('piano-overlay',w.pianoKeys);
 document.querySelectorAll('[data-timbre]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.timbre===timbre)));
}
function loadLandscape(value){project=value;history=[];future=[];selectedKeys.clear();selected=null;silentEdit=false;$('mute').setAttribute('aria-pressed','false');$('stage').classList.remove('silent-edit');applyWorkspace();drawPalette();render();setMode('play');updateHistory();renderLibrary();}
function createLandscape(value){stop();rememberWorkspace();const result=library.create(project,value);if(!saveFeedback(result))return false;loadLandscape(result.project);return true;}
$('saveLandscape').onclick=()=>{finishRecording();showTerrainSave({project,save(metadata){checkpoint();Object.assign(project,metadata);const saved=persist();render();return saved;}});};
$('duplicateLandscape').onclick=()=>{stop();rememberWorkspace();const copy=clone(project);copy.title=(project.title.slice(0,92)+(document.documentElement.lang==='zh-CN'?' 副本':' (copy)')).slice(0,100);createLandscape(copy);};

function checkpoint(){history.push(clone(project));if(history.length>50)history.shift();future=[];updateHistory();}
function changed(){persist();render();}
function updateHistory(){$('undo').disabled=!history.length;$('redo').disabled=!future.length;$('canvasUndo').disabled=!history.length;}
function id(){return crypto.randomUUID();}
function chosenSelection(){return selectionFor(project,selectedKeys);}
function chosenBells(){return chosenSelection().bells;}
function selectObject(key,preserveGroup=false){selected=key;if(!preserveGroup||!selectedKeys.has(key))selectedKeys=new Set(key?[key]:[]);syncSelection();}
function selectIds(ids){const valid=new Set(selectionKeys(project));selectedKeys=new Set(ids.filter(id=>valid.has(id)));selected=[...selectedKeys][0]||null;syncSelection();inspect();}
function syncSelection(){
 for(const el of $('bells').children){const active=selectedKeys.has(el.dataset.id);el.classList.toggle('selected',active);el.setAttribute('aria-description',active?'Selected · 已选择':'');}
 for(const el of $('ink').querySelectorAll('[data-line],[data-selection]'))el.classList.toggle('selected-line',selectedKeys.has(el.dataset.line||el.dataset.selection));
 for(const el of $('pathButtons').children){const active=selectedKeys.has('path:'+el.dataset.path);el.classList.toggle('selected',active);el.setAttribute('aria-description',active?'Selected path and play circle · 已选择路径':'');}
}
function positionBells(){for(const el of $('bells').children){const b=project.bells.find(b=>b.id===el.dataset.id);if(b){el.style.left=b.x+'px';el.style.top=b.y+'px';}}}
function nudgeSelection(dx,dy){const group=chosenSelection();if(!selectionSize(group))return;checkpoint();shiftSelection(group,dx,dy);reportActivity('object_move');persist();positionBells();renderInk();}
function pasteSelection(source,offset=28/project.view.zoom){if(!selectionSize(source))return;try{const copies=copySelection(project,source,id,offset),inkStart=project.ink.length;checkpoint();project.bells.push(...copies.bells);project.paths.push(...copies.paths);project.ink.push(...copies.ink);selectIds([...copies.bells.map(b=>b.id),...copies.paths.map(p=>'path:'+p.id),...copies.ink.map((_,i)=>'ink:'+(inkStart+i))]);reportActivity('bell_place');changed();}catch(e){status(e.message,true);}}
$('duplicate').onclick=()=>pasteSelection(chosenSelection());
let pitchAudition=0;
async function auditionTransposedNotes(notes){
 const request=++pitchAudition,events=notes.map(b=>({bell:b,event:eventOf(b)}));
 for(const b of notes)flash(b.id);
 if(silentEdit)return;
 try{
  if((!sound.ready&&!await sound.unlock())||request!==pitchAudition||silentEdit)return;
  const at=sound.now;
  for(const {bell,event} of events)if(bellModels.get(bell.id)===bell&&bell.midi===event.midi)sound.note(event,bell.id,at);
 }catch{status('Audio could not start. Try another tap or reload.',true);}
}
function transposeSelection(step){const bells=chosenBells().filter(b=>b.kind==='note');if(!canTranspose(bells,step))return;checkpoint();for(const b of bells)sound.stopGroup(b.id);transposeNotes(bells,step);reportActivity('pitch_change');changed();void auditionTransposedNotes(bells);}
$('pitchDown').onclick=()=>transposeSelection(-1);$('pitchUp').onclick=()=>transposeSelection(1);
function showSelectionBox(start,end){const v=project.view,box=$('selectionBox');box.hidden=false;box.style.left=(Math.min(start.x,end.x)+v.x)*v.zoom+'px';box.style.top=(Math.min(start.y,end.y)+v.y)*v.zoom+'px';box.style.width=Math.abs(end.x-start.x)*v.zoom+'px';box.style.height=Math.abs(end.y-start.y)*v.zoom+'px';}

function texture(midi){return [0,4,7].includes(midi%12)?'solid':[2,5,9,11].includes(midi%12)?'band':'stripe';}
function bellClass(b){return b.kind==='recorder'?'recorder':`${b.timbre} ${texture(b.midi)}`;}
const bellColor=midi=>color(midi,project.display.colors);
function noteMarkup(midi){const mode=project.display.notation;return `<span class="symbol" aria-hidden="true"></span>`+(mode==='off'?'':`<span class="note-label" aria-hidden="true">${mode==='jianpu'?jianpuMarkup(midi,project.display):noteName(midi)}</span>`);}
const instrumentName=inst=>({piano:'bass',epiano:'electric piano',grand:'piano',pluck:'pluck',vibes:'vibes',bowed:'bowed violin'})[inst];
function noteAccessible(midi,inst){return `${noteName(midi)} ${instrumentName(inst)}${project.display.notation==='jianpu'?', '+jianpuDescription(midi,project.display):''}`;}
function syncDisplay(){const d=project.display;document.querySelectorAll('[data-colors]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.colors===(d.colors||'original'))));$('notation').value=d.notation;$('tonic').value=d.tonic;$('accidentals').value=d.accidentals;$('jianpuOptions').hidden=d.notation!=='jianpu';$('notationReference').textContent=`Undotted 1 = ${TONICS[d.tonic]}4. Dots above/below shift by octaves. Display only; pitches stay fixed.`;}
function sampleStatus(states){const entries=Object.entries(states),loading=entries.some(([,s])=>s==='loading'),failed=entries.filter(([,s])=>s==='failed').map(([name])=>instrumentName(name));$('audioStatus').textContent=loading?'Loading sampled sounds; backup sounds are ready.':failed.length?`Backup sound active for ${failed.join(', ')}. Other sounds remain available.`:'Sampled bass, electric piano, piano, pluck and vibes ready.';$('retrySounds').hidden=!failed.length;}

function drawPalette(){
 const viewport=$('paletteViewport'),previous=paletteGeometry,offset=viewport.scrollLeft;
 if(!viewport.clientWidth)return;
 paletteGeometry=paletteLayout(viewport.clientWidth);
 const {width,keyWidth,columns}=paletteGeometry,keys=paletteKeys(paletteGeometry,project.palette);
 viewport.dataset.palette=project.palette;const paletteNames={diatonic:['Scrollable Diatonic pitch palette','Diatonic pitch palette'],pentatonic:['Scrollable pentatonic pitch palette','Pentatonic pitch palette'],chromatic:['Scrollable chromatic pitch palette','Chromatic pitch palette']};viewport.setAttribute('aria-label',paletteNames[project.palette][0]);$('palette').setAttribute('aria-label',paletteNames[project.palette][1]);
 document.querySelectorAll('button[data-palette]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.palette===project.palette)));
 $('palette').replaceChildren();$('palette').style.width=width+'px';
 for(const {midi,black,left,width} of keys){const el=document.createElement('button');el.className=`palette-note piano-key ${black?'black-key':'white-key'} ${timbre} ${texture(midi)}`;el.style.left=left+'px';el.style.width=width+'px';el.style.setProperty('--color',bellColor(midi));el.innerHTML=noteMarkup(midi);el.setAttribute('aria-label',`Play ${noteAccessible(midi,timbre)} in tray`);el.dataset.midi=midi;el.onpointerdown=e=>paletteStart(e,midi);el.onclick=e=>{if(e.detail===0)auditionPalette(midi,timbre,el);};$('palette').append(el);}
 viewport.scrollLeft=paletteCentered?(previous?Math.round(offset/previous.keyWidth)*keyWidth:offset):(['piano','grand'].includes(timbre)?0:Math.round((22-columns)/2)*keyWidth);
 paletteCentered=true;updatePaletteRange();
}
function settlePalette(){if(paletteGeometry){$('paletteViewport').scrollLeft=Math.round($('paletteViewport').scrollLeft/paletteGeometry.keyWidth)*paletteGeometry.keyWidth;updatePaletteRange();}}
function updatePaletteRange(){
 if(!paletteGeometry)return;
 const viewport=$('paletteViewport'),max=Math.max(0,viewport.scrollWidth-viewport.clientWidth),left=viewport.scrollLeft,overlay=viewport.classList.contains('piano-overlay');
 $('lowerOctave').disabled=left<=1;$('higherOctave').disabled=left>=max-1;
 const visible=[];
 for(const k of paletteKeys(paletteGeometry,project.palette)){
  const el=$('palette').querySelector(`[data-midi="${k.midi}"]`),center=k.left+k.width/2,radius=overlay?k.width/2:(k.black?19:26);
  const complete=center-radius>=left+4&&center+radius<=left+viewport.clientWidth-4;
  el.style.visibility=complete?'':'hidden';if(complete)visible.push(k);
 }
 $('visibleRange').textContent=visible.length?`${noteName(visible[0].midi)} – ${noteName(visible.at(-1).midi)}`:'C3 – C6';
}
function center(){return worldPoint($('stage').getBoundingClientRect().left+$('stage').clientWidth/2,$('stage').getBoundingClientRect().top+$('stage').clientHeight/2);}
function worldPoint(x,y){const r=$('stage').getBoundingClientRect(),v=project.view;return {x:(x-r.left)/v.zoom-v.x,y:(y-r.top)/v.zoom-v.y};}
function position(){const v=project.view;$('world').style.transform=`scale(${v.zoom}) translate(${v.x}px,${v.y}px)`;$('zoom').textContent=Math.round(v.zoom*100)+'%';}
function render(){
 syncDisplay();$('title').value=project.title;$('empty').hidden=!!(project.bells.length||project.ink.length||project.paths.length);$('counts').textContent=`${project.bells.length} bells · ${project.paths.length} paths`;
 $('bells').replaceChildren();bellElements.clear();bellModels.clear();
 for(const b of project.bells){const el=document.createElement('button');el.className=`bell ${bellClass(b)} ${selectedKeys.has(b.id)?'selected':''} ${sound.groups.has(b.id)?'playing':''}`;el.dataset.id=b.id;el.style.left=b.x+'px';el.style.top=b.y+'px';el.style.setProperty('--color',bellColor(b.midi??60));el.setAttribute('aria-label',b.kind==='note'?`${noteAccessible(b.midi,b.timbre)} bell`:`Play ${b.label}, ${b.events.length} notes`);
 if(b.kind==='note')el.innerHTML=noteMarkup(b.midi);else {const duration=Math.max(.5,b.events.at(-1).time);el.innerHTML='<svg viewBox="0 0 110 48" aria-hidden="true">'+b.events.map(e=>`<circle data-time="${e.time}" cx="${5+e.time/duration*100}" cy="${42-(e.midi-48)/36*36}" r="2.5" fill="${bellColor(e.midi)}"/>`).join('')+'</svg><span class="rec-label" data-no-translate></span><small>'+b.events.length+' notes</small>';el.querySelector('.rec-label').textContent=b.label;}
 el.onclick=e=>{if(e.detail===0){if(mode==='erase'){eraseObject(b.id);return;}selectObject(b.id,true);syncSelection();inspect();reportActivity(b.kind==='recorder'?(sound.groups.has(b.id)?'phrase_stop':'phrase_play'):'bell_play');activate(b);}};
 el.onkeydown=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(mode!=='move'&&mode!=='select')return;selectObject(b.id,true);nudgeSelection(e.key==='ArrowLeft'?-12:e.key==='ArrowRight'?12:0,e.key==='ArrowUp'?-12:e.key==='ArrowDown'?12:0);}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();selectObject(b.id,true);removeSelected();}};
 $('bells').append(el);bellElements.set(b.id,el);bellModels.set(b.id,b);}
 syncSelection();renderInk();position();inspect();updateHistory();drawPalette();
}
function renderInk(){
 const ns='http://www.w3.org/2000/svg';$('ink').replaceChildren();$('pathButtons').replaceChildren();pathButtons.clear();pathHeads.clear();lineElements.clear();
 const line=(points,key,musical,style=null)=>{const el=document.createElementNS(ns,'polyline');el.setAttribute('points',points);el.dataset.line=key;el.setAttribute('class',`drawn-line ${musical?'musical-line':''} ${selectedKeys.has(key)?'selected-line':''}`);el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label',musical?'Select musical path':'Select drawn line');el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();if(mode==='erase')eraseObject(key);else{selectObject(key);renderInk();inspect();}}if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();selectObject(key);removeSelected();}};const visible=el.cloneNode();visible.removeAttribute('data-line');visible.dataset.selection=key;visible.removeAttribute('role');visible.removeAttribute('tabindex');visible.removeAttribute('aria-label');visible.setAttribute('aria-hidden','true');visible.setAttribute('class',`line-visible ${musical?'musical-line':''} ${selectedKeys.has(key)?'selected-line':''}`);if(style){visible.style.setProperty('--ink-color',style.color);visible.style.setProperty('--ink-width',style.width);}
 el.classList.add('line-hit');$('ink').append(el,visible);lineElements.set(key,[el,visible]);};
 project.ink.forEach((stroke,i)=>line(strokePoints(stroke).map(p=>p.join(',')).join(' '),'ink:'+i,false,Array.isArray(stroke)?null:stroke));
 for(const path of project.paths){const key='path:'+path.id;line(path.points.map(p=>`${p.x},${p.y}`).join(' '),key,true);const start=path.points[0],button=document.createElement('button');button.className='path-button'+(selectedKeys.has(key)?' selected':'')+(activePaths.has(path.id)?' playing':'');button.style.left=start.x+'px';button.style.top=start.y+'px';button.dataset.path=path.id;button.dataset.loop=String(isLoopPath(path));button.textContent=activePaths.has(path.id)?'■':'▶';button.setAttribute('aria-label',`${activePaths.has(path.id)?'Stop':'Play'} path ${path.label}`);button.onclick=e=>{if(e.detail===0){if(mode==='erase'){eraseObject(key);return;}selectObject(key,true);inspect();startPath(path);}};$('pathButtons').append(button);pathButtons.set(path.id,button);
 if(activePaths.has(path.id)){const head=document.createElementNS(ns,'polygon');head.setAttribute('points','0,-10 8,8 -8,8');head.setAttribute('class','path-head');head.dataset.head=path.id;$('ink').append(head);pathHeads.set(path.id,head);}}
 syncPathPlayback();
}
function syncPathPlayback(){
 if(!activePaths.size&&pathFrame!==null){cancelAnimationFrame(pathFrame);pathFrame=null;}
 for(const path of project.paths){const button=pathButtons.get(path.id),playing=activePaths.has(path.id);if(button&&button.classList.contains('playing')!==playing){button.classList.toggle('playing',playing);button.textContent=playing?'■':'▶';button.setAttribute('aria-label',`${playing?'Stop':'Play'} path ${path.label}`);}
  for(const line of lineElements.get('path:'+path.id)||[])if(line.classList.contains('line-visible'))line.classList.toggle('playing-line',playing);
  if(playing&&!pathHeads.has(path.id)){const head=document.createElementNS('http://www.w3.org/2000/svg','polygon');head.setAttribute('points','0,-10 8,8 -8,8');head.setAttribute('class','path-head');head.dataset.head=path.id;$('ink').append(head);pathHeads.set(path.id,head);}
 }
 for(const [id,head] of pathHeads){const state=activePaths.get(id);if(!state){head.remove();pathHeads.delete(id);}else head.setAttribute('transform',`translate(${state.point.x} ${state.point.y})`);}
}
function updateGestureLine(key,points){for(const line of lineElements.get(key)||[])line.setAttribute('points',points);}
function selectedObject(){if(selected?.startsWith('ink:')){const index=Number(selected.slice(4));return project.ink[index]?{kind:'ink',index}:null;}if(selected?.startsWith('path:'))return project.paths.find(p=>p.id===selected.slice(5));return project.bells.find(b=>b.id===selected);}
function inspect(){
 syncDrawOptions();
 const box=$('selection'),obj=selectedObject(),group=chosenSelection(),count=selectionSize(group);box.replaceChildren();$('duplicate').disabled=!count;$('pitchDown').disabled=!canTranspose(group.bells,-1);$('pitchUp').disabled=!canTranspose(group.bells,1);
 const heading=document.createElement('div');heading.className='aside-title';heading.textContent='SELECTION';box.append(heading);const p=document.createElement('p');
 p.textContent=count>1?`${count} items selected · drag any selected item to move the group · Duplicate or ⌘/Ctrl+C then V to copy`:!obj?'Use Select to draw a box across bells, paths or drawings, or tap an object.':obj.kind==='ink'?'Drawn annotation · drag it in Select mode':obj.points?`Timed path · ${obj.points.at(-1).time.toFixed(2)} seconds`:obj.kind==='note'?(project.display.notation==='off'?`${instrumentName(obj.timbre)} bell`:project.display.notation==='jianpu'?jianpuDescription(obj.midi,project.display):`${noteName(obj.midi)} · ${instrumentName(obj.timbre)}`):`${obj.events.length} performed notes · ${obj.events.at(-1).time.toFixed(2)} seconds to last note`;box.append(p);if(!obj||count>1)return;
 if(obj.kind==='recorder'||obj.points){const input=document.createElement('input');input.value=obj.label;input.maxLength=50;input.setAttribute('aria-label',obj.points?'Path name':'Phrase name');input.onchange=()=>{checkpoint();obj.label=input.value.trim()||(obj.points?'Path':'Phrase');changed();};box.append(input);}

}
function removeSelected(){if(!selectedKeys.size)return;reportActivity('object_remove');checkpoint();eraseSelection();changed();}
function canvasObjectKey(target){
 const bell=target.closest('.bell'),line=target.closest('[data-line]'),path=target.closest('[data-path]');
 return bell?.dataset.id||line?.dataset.line||(path?'path:'+path.dataset.path:null);
}
function eraseObject(key){
 if(previewActivity||!key||!selectionKeys(project).includes(key))return false;
 // Erasing acts on the touched item, even when it belongs to a larger selection.
 selectObject(key);removeSelected();return true;
}
function eraseSelection(keys=selectedKeys){const group=selectionFor(project,keys);for(const b of group.bells)sound.stopGroup(b.id);for(const p of group.paths)activePaths.delete(p.id);project.bells=project.bells.filter(b=>!keys.has(b.id));project.paths=project.paths.filter(p=>!keys.has('path:'+p.id));project.ink=project.ink.filter((_,i)=>!keys.has('ink:'+i));selectObject(null);}
const groups=new Map();let groupCheckpoint=false;
function hideTrash(){
 $('trashTarget').hidden=true;$('trashTarget').classList.remove('drop-ready');$('stage').classList.remove('dragging-to-trash');
 for(const g of groups.values())g.trashArmed=false;
}
function overTrash(x,y){const r=$('trashTarget').getBoundingClientRect();return !$('trashTarget').hidden&&x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom;}
function updateTrash(g,x,y){
 if(previewActivity||groups.size!==1||!g.moved){hideTrash();return;}
 const target=$('trashTarget');target.hidden=false;$('stage').classList.add('dragging-to-trash');
 g.trashArmed=overTrash(x,y);target.classList.toggle('drop-ready',g.trashArmed);
 const count=selectionSize(g.targets),zh=document.documentElement.lang==='zh-CN';
 const title=zh?`废纸篓 · ${count} 项`:`Trash · ${count} ${count===1?'item':'items'}`;
 const hint=zh?(g.trashArmed?'松手删除':'拖到这里删除'):(g.trashArmed?'Release to delete':'Drop here to delete');
 if($('trashTitle').textContent!==title)$('trashTitle').textContent=title;
 if($('trashHint').textContent!==hint)$('trashHint').textContent=hint;
}
function beginGroupGesture(e,point,playPath=null){
 if(gesture||navigatorTouches.pinch)return;
 const keys=new Set(selectedKeys);if([...groups.values()].some(g=>[...g.keys].some(k=>keys.has(k))))return;
 groups.set(e.pointerId,{type:'group',pointer:e.pointerId,keys,originals:clone(chosenSelection()),targets:chosenSelection(),start:point,cx:e.clientX,cy:e.clientY,moved:false,playPath});
 hideTrash();
}

function moveGroup(g,dx,dy){const moved=clone(g.originals);shiftSelection(moved,dx,dy);moved.bells.forEach((b,i)=>{g.targets.bells[i].x=b.x;g.targets.bells[i].y=b.y;});moved.paths.forEach((p,i)=>g.targets.paths[i].points=p.points);moved.ink.forEach((stroke,i)=>{const points=strokePoints(g.targets.ink[i]);points.splice(0,points.length,...strokePoints(stroke));});positionBells();renderInk();}
async function startPath(path,restart=false){if(silentEdit&&!activePaths.has(path.id))return;const epoch=pathEpoch;try{if((!sound.ready&&!await sound.unlock())||epoch!==pathEpoch)return;if(activePaths.has(path.id)&&!restart){reportActivity('path_stop');activePaths.delete(path.id);syncPathPlayback();return;}if(silentEdit||!project.paths.includes(path))return;reportActivity('path_play');activePaths.set(path.id,pathState(path,sound.now,restart?project.paths.filter(p=>p!==gesture?.path):[]));syncPathPlayback();runPaths();}catch{status('Audio could not start for this path.',true);}}
function runPaths(){if(pathFrame!==null)return;const epoch=pathEpoch,frame=requestAnimationFrame(()=>{
 if(epoch!==pathEpoch||pathFrame!==frame)return;
 pathFrame=null;const result=advancePathNetwork(project.paths.filter(p=>p!==gesture?.path),project.bells,activePaths,sound.now);
 if(result.overflow){syncPathPlayback();status('Path network paused: too many crossings at once. Spread the start circles apart, then play again.',true);return;}
 for(const hit of result.notes){if(hit.bell.kind==='note')sound.note(eventOf(hit.bell),hit.bell.id,hit.at);else activate(hit.bell,false);}
 if(result.changes.length)syncPathPlayback();
 for(const [id,state] of activePaths){const head=pathHeads.get(id);head?.setAttribute('transform',`translate(${state.point.x} ${state.point.y})`);}
 if(activePaths.size)runPaths();
});pathFrame=frame;}
function flash(id){const el=bellElements.get(id);if(!el)return;el.classList.add('playing');clearTimeout(flashTimers.get(id));if(!sound.groups.has(id))flashTimers.set(id,setTimeout(()=>{el.classList.remove('playing');flashTimers.delete(id);},180));}
async function activate(b,manual=true){if(manual&&silentEdit){if(sound.groups.has(b.id))sound.stopGroup(b.id);return;}try{if((!sound.ready&&!await sound.unlock())||(manual&&silentEdit))return;if(bellModels.get(b.id)!==b)return;if(b.kind==='note')sound.note(eventOf(b),b.id);else {const wasPlaying=sound.groups.has(b.id);sound.play(b);if(!wasPlaying){flash(b.id);const el=bellElements.get(b.id);el?.querySelectorAll('circle').forEach(c=>c.style.opacity=.15);}}}catch{status('Audio could not start. Try another tap or reload.',true);}}
async function auditionPalette(midi,inst,el){if(silentEdit)return;try{if((!sound.ready&&!await sound.unlock())||silentEdit||!el.isConnected)return;reportActivity('tray_audition');sound.note(eventOf({midi,timbre:inst}),`tray:${inst}:${midi}`);el.classList.add('playing');setTimeout(()=>el.classList.remove('playing'),220);}catch{status('Audio could not start. Try another tap or reload.',true);}}
function addNote(midi,inst,point){if(project.bells.length>=500){status('This study holds up to 500 bells.',true);return;}checkpoint();const b={id:id(),kind:'note',midi,timbre:inst,label:noteName(midi),...point};project.bells.push(b);selectObject(b.id);reportActivity('bell_place');changed();activate(b);}
function paletteStart(e,midi){if(e.button!==0)return;e.preventDefault();const target=e.currentTarget,inst=timbre,viewport=$('paletteViewport');target.setPointerCapture(e.pointerId);if(midi!==null)auditionPalette(midi,inst,target);const origin={x:e.clientX,y:e.clientY,scroll:viewport.scrollLeft};let ghost,intent=null;
 const move=ev=>{if(ev.pointerId!==e.pointerId)return;const dx=ev.clientX-origin.x,dy=ev.clientY-origin.y;intent??=paletteIntent(dx,dy);if(intent==='scroll'){viewport.scrollLeft=origin.scroll-dx;updatePaletteRange();return;}if(intent==='place'&&midi!==null&&!ghost){ghost=document.createElement('div');ghost.className=`palette-note ${inst} ${texture(midi)} drag-ghost`;ghost.style.setProperty('--color',bellColor(midi));ghost.innerHTML=noteMarkup(midi);document.body.append(ghost);}if(ghost){ghost.style.left=ev.clientX-22+'px';ghost.style.top=ev.clientY-25+'px';}};
 const end=ev=>{if(ev.pointerId!==e.pointerId)return;cleanup();const r=$('stage').getBoundingClientRect();if(intent==='scroll'){settlePalette();return;}if(ev.type!=='pointerup'||midi===null)return;if(intent==='place'&&ev.clientX>=r.left&&ev.clientX<=r.right&&ev.clientY>=r.top&&ev.clientY<=r.bottom)addNote(midi,inst,worldPoint(ev.clientX,ev.clientY));};
 const cleanup=()=>{ghost?.remove();target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',end);target.removeEventListener('lostpointercapture',end);};target.addEventListener('pointermove',move);target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);target.addEventListener('lostpointercapture',end);
}

const touchPositions=new Map(),touches=new Map(),navigatorTouches=new TouchNavigator();
function canvasPoint(e){const r=$('stage').getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};}
function finishGroup(e){const g=groups.get(e.pointerId);if(!g)return false;
 const remove=e.type==='pointerup'&&g.moved&&g.trashArmed&&groups.size===1&&overTrash(e.clientX,e.clientY);
 groups.delete(e.pointerId);hideTrash();
 if(e.type!=='pointerup'&&g.moved)moveGroup(g,0,0);
 else if(g.moved){reportActivity(remove?'object_remove':'object_move');if(remove)eraseSelection(new Set([...g.targets.bells.map(b=>b.id),...g.targets.paths.map(p=>'path:'+p.id),...g.targets.ink.map(stroke=>project.ink.indexOf(stroke)).filter(i=>i>=0).map(i=>'ink:'+i)]));}
 else if(g.playPath&&e.type==='pointerup')startPath(g.playPath);
 if(!groups.size)groupCheckpoint=false;if(g.moved){persist();render();}return true;
}

$('stage').onpointerdown=e=>{
 // Secondary click (including macOS Control-click) belongs to context erase,
 // never audition, painting or navigation. Handle it once on contextmenu.
 if(e.button!==0||(e.ctrlKey&&e.pointerType!=='touch')||e.target.closest('#empty button,#drawOptions,#viewNavigation'))return;e.preventDefault();
 if(mode==='erase'){eraseObject(canvasObjectKey(e.target));return;}
 const hit=e.target.closest('.bell'),bell=bellModels.get(hit?.dataset.id),line=e.target.closest('[data-line]'),pathButton=e.target.closest('[data-path]'),key=line?.dataset.line||(pathButton?'path:'+pathButton.dataset.path:null),point=worldPoint(e.clientX,e.clientY);$('stage').setPointerCapture(e.pointerId);
 if(e.pointerType==='touch'){
  const eligible=!navigatorTouches.pinch&&!navigatorTouches.suppressed.size&&!bell&&!key&&!groups.size&&mode==='move'&&(!gesture||['pan','marquee'].includes(gesture.type));
  if(navigatorTouches.down(e.pointerId,canvasPoint(e),eligible,project.view)){
   if(gesture?.type==='marquee')selectIds(gesture.before);$('selectionBox').hidden=true;gesture=null;$('stage').classList.add('navigating');return;
  }
  if(navigatorTouches.pinch||navigatorTouches.suppressed.has(e.pointerId))return;
 }
 if(mode==='strum'){reportActivity('strum_gesture');touches.set(e.pointerId,new Set());strumAt(e);return;}
 if(mode==='draw'||mode==='path'){
  if(gesture)return;if(project.ink.length>=500||project.paths.length>=200){status('This landscape has reached the line limit.',true);return;}checkpoint();
  if(mode==='draw'){const stroke={points:[[point.x,point.y]],color:inkColor,width:inkWidth};project.ink.push(stroke);selectObject('ink:'+(project.ink.length-1));gesture={type:'ink',pointer:e.pointerId,stroke};}
  else{const path={id:id(),label:'Path '+(project.paths.length+1),points:[{...point,time:0}]};project.paths.push(path);selectObject('path:'+path.id);gesture={type:'path',pointer:e.pointerId,path,start:performance.now()};touches.set(e.pointerId,new Set());strumAt(e);}
  renderInk();return;
 }
 if(mode==='play'){if(bell){reportActivity(bell.kind==='recorder'?(sound.groups.has(bell.id)?'phrase_stop':'phrase_play'):'bell_play');activate(bell);}else if(pathButton){const path=project.paths.find(p=>p.id===pathButton.dataset.path);if(path)startPath(path);}return;}
 if(key){
  if(mode==='select'&&e.shiftKey){const ids=new Set(selectedKeys);ids.has(key)?ids.delete(key):ids.add(key);selectIds([...ids]);return;}
  selectObject(key,true);renderInk();inspect();if(mode==='play'){if(pathButton)startPath(selectedObject());}else beginGroupGesture(e,point,pathButton?selectedObject():null);return;
 }
 if(bell){
  if(mode==='select'&&e.shiftKey){const ids=new Set(selectedKeys);ids.has(bell.id)?ids.delete(bell.id):ids.add(bell.id);selectIds([...ids]);return;}
  reportActivity(bell.kind==='recorder'?(sound.groups.has(bell.id)?'phrase_stop':'phrase_play'):'bell_play');activate(bell);if(selected!==bell.id||!selectedKeys.has(bell.id)){selectObject(bell.id,true);inspect();}
  if(mode==='move'||mode==='select')beginGroupGesture(e,point);
 }
 else if(mode==='select'&&!gesture&&!groups.size){const before=[...selectedKeys];if(!e.shiftKey)selectObject(null);syncSelection();renderInk();inspect();gesture={type:'marquee',pointer:e.pointerId,start:point,before,base:e.shiftKey?before:[]};showSelectionBox(point,point);}
 else if(mode==='move'&&!gesture&&!groups.size)gesture={type:'pan',pointer:e.pointerId,x:e.clientX,y:e.clientY,origin:{...project.view}};
};
$('stage').oncontextmenu=e=>{
 if(previewActivity||e.target.closest('#empty button,#drawOptions,#viewNavigation,#startGuide'))return;
 e.preventDefault();
 // A long touch must not delete an item while someone is playing it.
 if(e.pointerType==='touch')return;
 const key=canvasObjectKey(e.target);if(!key)return;
 endGestureSafely();eraseObject(key);
};
function strumAt(e){
 const p=worldPoint(e.clientX,e.clientY),previous=touches.get(e.pointerId),start=touchPositions.get(e.pointerId)||p;
 const targets=[...project.bells,...((mode==='strum'||mode==='path')?project.paths.filter(path=>path!==gesture?.path).map(path=>({id:'path:'+path.id,kind:'path',...path.points[0],path})):[])];
 const result=pathHits([{...start,time:0},{...p,time:1}],0,1,targets,previous);
 for(const {bell} of result.hits)if(bell.kind==='path')startPath(bell.path,mode==='path'||e.type!=='pointerdown');else activate(bell);
 touches.set(e.pointerId,result.inside);touchPositions.set(e.pointerId,p);
}
$('stage').onpointermove=e=>{
 if(navigatorTouches.suppressed.has(e.pointerId))return;
 const view=navigatorTouches.move(e.pointerId,canvasPoint(e));if(view){project.view=view;position();return;}
 const group=groups.get(e.pointerId);if(group){const p=worldPoint(e.clientX,e.clientY);if(!group.moved&&Math.hypot(e.clientX-group.cx,e.clientY-group.cy)>6){if(!groupCheckpoint){checkpoint();groupCheckpoint=true;}group.moved=true;}if(group.moved)moveGroup(group,p.x-group.start.x,p.y-group.start.y);updateTrash(group,e.clientX,e.clientY);return;}
 if(touches.has(e.pointerId)){strumAt(e);if(gesture?.type!=='path')return;}if(!gesture||gesture.pointer!==e.pointerId)return;const g=gesture,p=worldPoint(e.clientX,e.clientY);
 if(g.type==='marquee'){showSelectionBox(g.start,p);selectIds([...g.base,...itemsInBox(project,g.start,p)]);}
 else if(g.type==='path'){if(g.path.points.length<3000)g.path.points.push({...p,time:Math.min(600,(performance.now()-g.start)/1000)});updateGestureLine('path:'+g.path.id,g.path.points.map(p=>`${p.x},${p.y}`).join(' '));}
 else if(g.type==='ink'){const points=strokePoints(g.stroke);if(points.length<3000){points.push([p.x,p.y]);updateGestureLine('ink:'+project.ink.indexOf(g.stroke),points.map(p=>p.join(',')).join(' '));}}
 else if(g.type==='pan'){project.view.x=g.origin.x+(e.clientX-g.x)/project.view.zoom;project.view.y=g.origin.y+(e.clientY-g.y)/project.view.zoom;position();}
 
};
function finishPointer(e){if(e.type==='pointerup'&&touches.has(e.pointerId))strumAt(e);const navigation=navigatorTouches.up(e.pointerId,e.type!=='pointerup');if(navigation){if(navigation.cancelled)project.view=navigation.origin;$('stage').classList.remove('navigating');position();persist();}touches.delete(e.pointerId);touchPositions.delete(e.pointerId);if(finishGroup(e))return;if(gesture?.pointer!==e.pointerId)return;const g=gesture;gesture=null;
 if(g.type==='marquee'){$('selectionBox').hidden=true;if(e.type!=='pointerup')selectIds(g.before);return;}
 if(g.type==='path'){if(e.type!=='pointerup'||g.path.points.length<2){project.paths=project.paths.filter(p=>p!==g.path);selectObject(null);}else{const last=g.path.points.at(-1);const end={...worldPoint(e.clientX,e.clientY),time:Math.max(last.time,.01,Math.min(600,(performance.now()-g.start)/1000))};if(g.path.points.length<3000)g.path.points.push(end);else g.path.points[g.path.points.length-1]=end;setMode('select');reportActivity('path_draw');}}
 if(g.type==='ink'){if(e.type!=='pointerup')project.ink=project.ink.filter(s=>s!==g.stroke);else reportActivity('line_draw');}if(g.type==='pan'&&e.type!=='pointerup')project.view=g.origin; persist();render();if(g.type==='path'&&e.type==='pointerup'&&project.paths.includes(g.path)&&isLoopPath(g.path))startPath(g.path,true);
}
$('stage').onpointerup=finishPointer;$('stage').onpointercancel=finishPointer;$('stage').onlostpointercapture=finishPointer;
for(const type of ['touchmove','gesturestart','gesturechange'])$('stage').addEventListener(type,e=>e.preventDefault(),{passive:false});
function endGestureSafely(){
 hideTrash();
 $('selectionBox').hidden=true;if(gesture?.type==='marquee')selectIds(gesture.before);
 if(gesture?.type==='path'){project.paths=project.paths.filter(p=>p!==gesture.path);selectObject(null);}
 if(gesture?.type==='ink'){project.ink=project.ink.filter(s=>s!==gesture.stroke);selectObject(null);}
 if(gesture?.type==='pan')project.view=gesture.origin;
 if(navigatorTouches.pinch)project.view=navigatorTouches.pinch.origin;
 for(const g of groups.values())if(g.moved)moveGroup(g,0,0);
 groups.clear();groupCheckpoint=false;gesture=null;touches.clear();touchPositions.clear();navigatorTouches.clear();$('stage').classList.remove('navigating');position();renderInk();
}
function setMode(next){if(previewActivity&&!['play','strum'].includes(next))return;endGestureSafely();if(mode!==next)reportActivity('mode_change');mode=next;for(const m of ['play','move','draw','strum','path','select','erase'])$(m).setAttribute('aria-pressed',m===next);$('stage').dataset.mode=next;document.body.dataset.tool=next;$('viewNavigation').hidden=next!=='move';syncDrawOptions();const hints={play:'Tap bells and path circles to play · canvas locked',move:'Drag bells to arrange · drag or pinch empty space to navigate',draw:'Choose a color and width · draw · Undo reverses your last stroke',strum:'Slide across bells or path play circles to play them',path:'Trace a timed path across bells · lift to finish · tap ▶ to replay',select:'Box-select · move or duplicate · use pitch buttons to transpose',erase:'Tap a bell, path or painted line to erase · Right-click also erases · Undo restores it'};$('modeHint').querySelector('strong').textContent=silentEdit?'Silent edit':$(next).getAttribute('aria-label');$('modeHint').querySelector('span').textContent=silentEdit?'Rearrange without triggering sound · running paths and phrases continue':hints[next];}
$('mute').onclick=()=>{silentEdit=!silentEdit;$('mute').setAttribute('aria-pressed',String(silentEdit));$('stage').classList.toggle('silent-edit',silentEdit);setMode(mode);};
document.querySelectorAll('button[data-palette]').forEach(button=>button.onclick=()=>{if(project.palette===button.dataset.palette)return;checkpoint();project.palette=button.dataset.palette;reportActivity('display_change');changed();});
for(const m of ['play','move','draw','strum','path','select','erase'])$(m).onclick=()=>setMode(mode===m?'play':m);
function syncDrawOptions(){const strokes=mode==='select'?chosenSelection().ink:[];$('drawOptions').hidden=mode!=='draw'&&!strokes.length;
 for(const b of document.querySelectorAll('[data-ink-color]'))b.setAttribute('aria-pressed',String(strokes.length?strokes.every(s=>(s.color||INK_COLORS[0])===b.dataset.inkColor):inkColor===b.dataset.inkColor));
 for(const b of document.querySelectorAll('[data-ink-width]'))b.setAttribute('aria-pressed',String(strokes.length?strokes.every(s=>(s.width||3)===Number(b.dataset.inkWidth)):inkWidth===Number(b.dataset.inkWidth)));
}
function setInkStyle(key,value){if(key==='color')inkColor=value;else inkWidth=value;
 if(mode==='select'&&chosenSelection().ink.length){checkpoint();project.ink=project.ink.map((stroke,i)=>selectedKeys.has('ink:'+i)?{points:strokePoints(stroke),color:stroke.color||INK_COLORS[0],width:stroke.width||3,[key]:value}:stroke);reportActivity('display_change');changed();}else{syncDrawOptions();persist();}
}
for(const button of document.querySelectorAll('[data-ink-color]'))button.onclick=()=>setInkStyle('color',button.dataset.inkColor);
for(const button of document.querySelectorAll('[data-ink-width]'))button.onclick=()=>setInkStyle('width',Number(button.dataset.inkWidth));
$('canvasUndo').onclick=()=>$('undo').click();
function zoomBy(factor){const p=center(),r=$('stage'),z=Math.min(2,Math.max(.4,project.view.zoom*factor));project.view={zoom:z,x:r.clientWidth/2/z-p.x,y:r.clientHeight/2/z-p.y};position();persist();}
$('zoomin').onclick=()=>zoomBy(1.2);$('zoomout').onclick=()=>zoomBy(1/1.2);
$('home').onclick=()=>{const bells=project.bells;if(!bells.length){project.view={x:0,y:0,zoom:1};}else{const minX=Math.min(...bells.map(b=>b.x))-90,maxX=Math.max(...bells.map(b=>b.x))+90,minY=Math.min(...bells.map(b=>b.y))-70,maxY=Math.max(...bells.map(b=>b.y))+100;const z=Math.min(1.3,Math.max(.4,Math.min($('stage').clientWidth/(maxX-minX),$('stage').clientHeight/(maxY-minY))));project.view={zoom:z,x:$('stage').clientWidth/2/z-(minX+maxX)/2,y:$('stage').clientHeight/2/z-(minY+maxY)/2};}position();persist();};
for(const button of document.querySelectorAll('[data-colors]'))button.onclick=()=>{if((project.display.colors||'original')===button.dataset.colors)return;checkpoint();project.display.colors=button.dataset.colors;reportActivity('display_change');changed();};
for(const [id,key] of [['notation','notation'],['tonic','tonic'],['accidentals','accidentals']])$(id).onchange=e=>{checkpoint();project.display[key]=key==='tonic'?Number(e.target.value):e.target.value;reportActivity('display_change');changed();};
$('retrySounds').onclick=async()=>{try{if(await sound.unlock())await sound.samples.retry(sound.ctx,sound.master);}catch{status('Audio could not start. Try another tap.',true);}};
$('pianoOverlay').onchange=e=>{reportActivity('display_change');$('paletteViewport').classList.toggle('piano-overlay',e.target.checked);updatePaletteRange();persist();};
$('lowerOctave').onclick=()=>{$('paletteViewport').scrollLeft-=7*paletteGeometry.keyWidth;updatePaletteRange();};
$('higherOctave').onclick=()=>{$('paletteViewport').scrollLeft+=7*paletteGeometry.keyWidth;updatePaletteRange();};
$('paletteViewport').onkeydown=e=>{
 if(e.target!==e.currentTarget)return;
 const viewport=e.currentTarget,steps={ArrowLeft:-paletteGeometry.keyWidth,ArrowRight:paletteGeometry.keyWidth,PageUp:-7*paletteGeometry.keyWidth,PageDown:7*paletteGeometry.keyWidth};
 if(e.key==='Home')viewport.scrollLeft=0;
 else if(e.key==='End')viewport.scrollLeft=viewport.scrollWidth;
 else if(e.key in steps)viewport.scrollLeft+=steps[e.key];
 else return;
 e.preventDefault();updatePaletteRange();
};
$('paletteViewport').onscroll=updatePaletteRange;
$('paletteViewport').addEventListener('scrollend',settlePalette);
$('paletteViewport').onpointerdown=e=>{if(e.target===e.currentTarget||e.target===$('palette'))paletteStart(e,null);};
new ResizeObserver(()=>{if($('paletteViewport').clientWidth)drawPalette();}).observe($('paletteViewport'));
document.querySelectorAll('[data-timbre]').forEach(el=>el.onclick=()=>{timbre=el.dataset.timbre;if(['piano','grand'].includes(timbre))paletteCentered=false;reportActivity('timbre_change');void sound.unlock().catch(()=>status('Audio could not start. Try a bell.',true));document.querySelectorAll('[data-timbre]').forEach(b=>b.setAttribute('aria-pressed',b===el));drawPalette();persist();});
function updateRecordButton(recording){const button=$('record'),en=recording?'Finish phrase':'Record a phrase',zh=recording?'完成乐句':'录制乐句';button.classList.toggle('active',recording);document.querySelector('.record-bar').classList.toggle('recording',recording);button.setAttribute('aria-pressed',String(recording));button.setAttribute('aria-label',en+' · '+zh);button.querySelectorAll('[lang=en]').forEach(el=>el.textContent=el.closest('.tool-label')&&!recording?'Record phrase':en);button.querySelectorAll('[lang=zh-CN]').forEach(el=>el.textContent=zh);}
function finishRecording(){if(!capture)return;const events=normalizeCapture(capture.events);capture=null;updateRecordButton(false);$('recordStatus').textContent='Turn a performance into a playable bell.';if(events.length){reportActivity('record_finish');checkpoint();const p=center();const b={id:id(),kind:'recorder',label:'Phrase '+(project.bells.filter(b=>b.kind==='recorder').length+1),x:p.x,y:p.y,events};project.bells.push(b);selectObject(b.id);changed();}else{persist();if(document.body.dataset.saved==='true')status('No notes were played; no empty recorder was created.');}}
$('record').onclick=async()=>{if(capture){finishRecording();return;}if(project.bells.length>=500){status('Remove a bell before making another phrase.',true);return;}const remaining=20000-project.bells.filter(b=>b.kind==='recorder').reduce((n,b)=>n+b.events.length,0);if(remaining<=0){status('This landscape has reached the recorded-note limit. Download it, then start a new landscape.',true);return;}try{if(!await sound.unlock())return;reportActivity('record_start');capture={started:sound.now,events:[],limit:Math.min(5000,remaining)};updateRecordButton(true);recordingPending();$('recordStatus').textContent='Recording your played notes…';}catch{status('Audio could not start.',true);}};
function stop(){endGestureSafely();pathEpoch++;activePaths.clear();if(pathFrame!==null){cancelAnimationFrame(pathFrame);pathFrame=null;}sound.stop();renderInk();finishRecording();document.querySelectorAll('.playing').forEach(el=>el.classList.remove('playing'));}
$('stop').onclick=()=>{reportActivity('stop_all');stop();};
function replace(p){return createLandscape(p);}
$('study').onclick=()=>{if(replace(study())){reportActivity('example_open');$('home').click();}};$('new').onclick=()=>{const value=blank();value.title=(document.documentElement.lang==='zh-CN'?'作品 ':'Landscape ')+(library.entries.length+1);if(replace(value))reportActivity('landscape_new');};
$('undo').onclick=()=>{stop();if(!history.length)return;reportActivity('undo');future.push(clone(project));project=history.pop();applyWorkspace();selectObject(null);changed();};$('redo').onclick=()=>{stop();if(!future.length)return;reportActivity('redo');history.push(clone(project));project=future.pop();applyWorkspace();selectObject(null);changed();};
let renaming=false;$('title').onfocus=()=>renaming=false;$('title').oninput=e=>{if(!renaming){checkpoint();renaming=true;}project.title=e.target.value.slice(0,100);persist();};$('title').onblur=()=>renaming=false;
function downloadData(value,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('download').onclick=()=>{finishRecording();rememberWorkspace();reportActivity('export_requested');downloadData(project,(project.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'-').trim().slice(0,70)||'melodymorph-landscape')+'.json');status('Landscape download requested. Verify the file before leaving; this does not mark browser storage as saved.');};
$('recoveryExport').onclick=()=>{finishRecording();rememberWorkspace();const recovery=library.recoveryData(project);if(!recovery)return;downloadData(recovery,'melodymorph-recovery.json');status('Recovery download requested. Keep this file for repair. Export landscape makes a playable copy to import in another browser. The damaged library has not been changed.');};
$('open').onclick=()=>$('file').click();$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>4_000_000)throw Error('This file exceeds the study’s 4 MB limit.');const p=validate(JSON.parse(await f.text()));if(replace(p))reportActivity('import_complete');}catch(err){reportActivity('import_rejected');status('Could not open: '+err.message,true);}e.target.value='';};
function editingTarget(target){return !!target.closest('input,textarea,select,[contenteditable=true]');}
document.addEventListener('copy',e=>{
 const group=chosenSelection();if(editingTarget(e.target)||!selectionSize(group)||document.getSelection()?.toString()||!e.clipboardData)return;
 clipboardSignature=JSON.stringify({format:'melodymorph-selection/1',...clone(group)});pasteCount=0;
 e.clipboardData.setData('text/plain',clipboardSignature);e.preventDefault();status(`Copied ${selectionSize(group)} items. Use ⌘/Ctrl+V to paste.`);
});
document.addEventListener('paste',e=>{
 if(editingTarget(e.target)||!e.clipboardData)return;const text=e.clipboardData.getData('text/plain');if(text.length>4000000)return;
 try{const data=JSON.parse(text);if(!['melodymorph-bells/1','melodymorph-selection/1'].includes(data?.format))return;e.preventDefault();const source=blank();source.bells=data.bells;if(data.format==='melodymorph-selection/1'){source.paths=data.paths;source.ink=data.ink;}const group=validate(source);if(text!==clipboardSignature){clipboardSignature=text;pasteCount=0;}pasteSelection(group,28*(++pasteCount)/project.view.zoom);}catch{status('This clipboard selection is not a valid MelodyMorph group.',true);}
});
window.addEventListener('keydown',e=>{
 const editing=!!e.target.closest('input,textarea,select,[contenteditable=true]'),command=e.ctrlKey||e.metaKey;
 if(!editing&&!e.defaultPrevented){
  if(['Delete','Backspace'].includes(e.key)&&selectedObject()){e.preventDefault();removeSelected();}
  else if(command&&e.key.toLowerCase()==='d'&&selectedKeys.size){e.preventDefault();pasteSelection(chosenSelection());}
  else if(command&&e.key.toLowerCase()==='a'&&mode==='select'){e.preventDefault();selectIds(selectionKeys(project));renderInk();}
  else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)&&mode==='select'&&selectedKeys.size){e.preventDefault();const step=e.shiftKey?48:12;nudgeSelection(e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0);}
 }
 if(e.key==='Escape'&&$('workspaceMenu').open){e.preventDefault();closeSettings(true);return;}
 if(e.key==='Escape'){stop();selectObject(null);syncSelection();inspect();setMode('play');}
 if(command&&e.key.toLowerCase()==='z'&&!editing){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}
});
function closeSettings(restoreFocus=false){$('workspaceMenu').open=false;if(restoreFocus)$('workspaceMenu').querySelector('summary').focus();}
$('closeSettings').onclick=()=>closeSettings(true);
document.addEventListener('pointerdown',e=>{if($('workspaceMenu').open&&!$('workspaceMenu').contains(e.target))closeSettings();});
applyWorkspace();renderLibrary();
drawPalette();render();setMode('play');persist();installToolRail({preferenceKey:STORE+':left-handed'});installStartGuide({enabled:!previewActivity});installCanvasView({onLayout:()=>{endGestureSafely();persist();}});installLanguage();

installPersistenceGuard({prepare:()=>{stop();return persist();},onBlocked:()=>{$('workspaceMenu').open=true;}});

function fitActivityView(){
 if(!previewActivity)return;
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 const include=(x,y,rx=30,ry=30)=>{minX=Math.min(minX,x-rx);maxX=Math.max(maxX,x+rx);minY=Math.min(minY,y-ry);maxY=Math.max(maxY,y+ry);};
 for(const b of project.bells)include(b.x,b.y,b.kind==='recorder'?70:40,b.kind==='recorder'?65:40);
 for(const p of project.paths)for(const q of p.points)include(q.x,q.y);
 for(const s of project.ink)for(const [x,y] of strokePoints(s))include(x,y,10,10);
 if(!Number.isFinite(minX))return;
 const stage=$('stage'),z=Math.min(1.3,Math.max(.4,Math.min((stage.clientWidth-32)/(maxX-minX),(stage.clientHeight-70)/(maxY-minY))));
 project.view={zoom:z,x:stage.clientWidth/2/z-(minX+maxX)/2,y:(stage.clientHeight-38)/2/z-(minY+maxY)/2};position();
}
installActivityPlayer({load:loadLandscape,stop,fit:fitActivityView});

// Optional central storage is isolated from startup, audio and tablet gestures.
const cloudReady=!previewActivity?import('./terrain-cloud.mjs').then(({installTerrainCloud})=>installTerrainCloud({library,key:STORE,prepareShare(){finishRecording();return persist()?library.value.activeId:null;},loadRemote(value,existingId){
  stop();rememberWorkspace();
  const result=library.restore(project,value,existingId);
  if(!saveFeedback(result))return null;loadLandscape(result.project);return library.value.activeId;
}})).catch(()=>undefined):Promise.resolve(undefined);
if(!previewActivity)installTerrainGallery({library,getCloud:()=>cloudReady,prepare(){stop();return persist();},openLocal(id){
 if(id===library.value.activeId)return true;stop();rememberWorkspace();const result=library.open(project,id);if(!saveFeedback(result))return false;loadLandscape(result.project);return true;
},createLocal:createLandscape});
