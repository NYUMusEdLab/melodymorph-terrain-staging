import {blank} from './model.mjs';
import {validateDescription,countDescriptionSentences} from './description-contract.mjs';
import {terrainThumbnail} from './terrain-thumbnail.mjs';
import {previewTerrain} from './terrain-preview.mjs';
import {validateLibrarySnapshot,remixLibrarySnapshot} from './library-snapshot.mjs';
import {fingerprint} from './terrain-sync.mjs';
import {UUID} from './activity-contract.mjs';
const t=(en,zh)=>document.documentElement.lang==='zh-CN'?zh:en;
function el(tag,text,cls){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
function button(text,action){const b=el('button',text);b.type='button';b.onclick=action;return b;}
function dialog(title,large=false){
 const d=el('dialog',undefined,'terrain-dialog'+(large?' terrain-gallery':''));d.dataset.noTranslate='';
 const header=el('div',undefined,'terrain-dialog-heading'),h=el('h2',title),close=button('×',()=>d.close());h.id='terrainDialog-'+crypto.randomUUID();d.setAttribute('aria-labelledby',h.id);close.setAttribute('aria-label',t('Close','关闭'));header.append(h,close);d.append(header);
 for(const type of ['keydown','copy','cut','paste'])d.addEventListener(type,e=>e.stopPropagation());
 d.addEventListener('close',()=>d.remove(),{once:true});document.body.append(d);return d;
}
function field(form,name,label,value,max,multiline=false){
 const wrapper=el('label',label,'terrain-field'),input=el(multiline?'textarea':'input');input.name=name;input.maxLength=max;input.value=value||'';if(multiline)input.rows=3;wrapper.append(input);form.append(wrapper);return input;
}
function descriptionFeedback(input,status){
 const valid=validateDescription(input.value),count=countDescriptionSentences(input.value);
 input.setCustomValidity(valid?'':t('Use at most three sentences and 600 characters.','请使用不超过三句话、600 个字符。'));
 status.textContent=t(`${count}/3 sentences · ${input.value.length}/600 characters`,`${count}/3 句话 · ${input.value.length}/600 个字符`);return valid;
}
export function showTerrainSave({project,save}){
 const d=dialog(t('Save my terrain','保存我的作品')),form=el('form');
 const title=field(form,'title',t('Title','标题'),project.title,100),description=field(form,'description',t('Description · up to three sentences','简介 · 最多三句话'),project.description,600,true),hint=el('p',undefined,'terrain-hint'),state=el('p');state.role='status';title.required=true;
 form.append(hint,el('p',t('Your music is already autosaved on this browser. This names your own copy; it does not share it.','音乐会自动保存在此浏览器中。此处为自己的作品命名，不会公开分享。')));
 const actions=el('div',undefined,'terrain-actions'),submit=el('button',t('Save my terrain','保存我的作品'));submit.type='submit';actions.append(button(t('Cancel','取消'),()=>d.close()),submit);form.append(state,actions);d.append(form);
 description.oninput=()=>descriptionFeedback(description,hint);descriptionFeedback(description,hint);
 form.onsubmit=e=>{e.preventDefault();if(!descriptionFeedback(description,hint)||!title.value.trim()){state.textContent=t('Enter a title and a description of at most three sentences.','请输入标题和不超过三句话的简介。');return;}if(save({title:title.value.trim(),description:description.value.trim()}))d.close();else state.textContent=t('The browser could not save. Keep this page open and export a backup.','浏览器无法保存。请保持此页打开并导出备份。');};d.showModal();title.focus();
 return d;
}
export function installTerrainGallery({library,prepare,getCloud,openLocal,createLocal}){
 const openButton=document.getElementById('openGallery');
 async function remoteFor(localId){
  const sync=await getCloud(),api=sync?.api;
  if(!api?.enabled||api.config.librarySharingEnabled!==true)throw Error(t('Shared library is not enabled yet. Your terrain is saved on this browser.','共享作品库尚未启用。作品已保存在此浏览器中。'));
  if(!api.signedIn)throw Error(t('Sign in with an enrolled account to share. Guests can browse and keep local remixes when the library is enabled.','分享需要登录已获授权的账户。作品库启用后，访客可浏览并在本地保存改编。'));
  if(sync.busy)throw Error(t('A private save is syncing. Try again when it finishes.','私人作品正在同步，请完成后重试。'));
  await sync.flush();const record=sync.ledger.entries[localId],entry=library.value.entries.find(e=>e.id===localId);
  if(!record||!entry||record.owner!==api.me?.creator_id||record.hash!==await fingerprint(entry.project)||sync.conflicts.has(localId)||sync.ledgerDirty)throw Error(t('Sync this private terrain successfully before sharing.','请先成功同步此私人作品再分享。'));
  const terrain=await api.request('/terrains/'+record.id);return {api,terrain};
 }
 async function share(localId,state){
  try{
   const {api,terrain}=await remoteFor(localId),d=dialog(t('Share to library','分享到作品库')),form=el('form');
   const title=field(form,'title',t('Public title','公开标题'),terrain.project.title,100),description=field(form,'description',t('Public description · up to three sentences','公开简介 · 最多三句话'),terrain.project.description,600,true),hint=el('p',undefined,'terrain-hint'),attribution=field(form,'attribution',t('Public author name or class alias','公开作者名或班级别名'),'',100);
   title.required=true;form.append(hint);description.oninput=()=>descriptionFeedback(description,hint);descriptionFeedback(description,hint);
   const check=(name,label)=>{const l=el('label',undefined,'terrain-check'),input=el('input');input.type='checkbox';input.name=name;l.append(input,el('span',label));form.append(l);return input;};
   const ink=check('ink',t('Include my painted lines','包含绘画线条')),remix=check('remix',t('Allow others to make their own independent copies','允许他人创建独立改编副本')),review=check('review',t('I have permission to share this music, title, description and alias with anyone. I checked that they contain no student names or other private information.','我有权向所有人分享这些音乐、标题、简介和别名，并已确认其中没有学生姓名等私人信息。'));
   const image=el('img');image.alt=t('Musical terrain preview','音乐作品预览');image.className='terrain-share-image';const updateImage=()=>{image.src=terrainThumbnail({...terrain.project,ink:ink.checked?terrain.project.ink:[]});};ink.onchange=updateImage;updateImage();form.append(image,el('p',t('This shares a fixed copy. New private edits withdraw it until you share again. It does not publish to the world map. Existing downloaded copies cannot be recalled.','这会分享固定版本。后续私人编辑会撤下此版本，需再次分享。不会发布到世界地图；已下载的副本无法收回。')));
   const message=el('p');message.role='status';const submit=el('button',t('Share this snapshot','分享此版本'));submit.type='submit';submit.disabled=true;review.onchange=()=>submit.disabled=!review.checked;const actions=el('div',undefined,'terrain-actions');actions.append(button(t('Cancel','取消'),()=>d.close()),submit);
   if(terrain.library_shared)actions.prepend(button(t('Withdraw from library','从作品库撤下'),async()=>{try{await api.request('/terrains/'+terrain.id+'/library-unshare',{method:'POST',body:{expected_revision:terrain.revision}});d.close();state.textContent=t('Withdrawn from the shared library. Your private copy is preserved.','已从共享作品库撤下，私人副本仍保留。');}catch(e){message.textContent=e.message;}}));
   form.append(message,actions);d.append(form);form.onsubmit=async e=>{e.preventDefault();if(!review.checked||!title.value.trim()||!descriptionFeedback(description,hint)){message.textContent=t('Enter a public title, use at most three sentences, and confirm your permission to share.','请输入公开标题、不超过三句话的简介，并确认分享权限。');return;}submit.disabled=true;try{
    await api.request('/terrains/'+terrain.id+'/library-share',{method:'POST',body:{expected_revision:terrain.revision,settings:{title:title.value.trim(),description:description.value.trim(),attribution:attribution.value.trim(),include_ink:ink.checked,privacy_reviewed:true},allow_remix:remix.checked}});
    d.close();state.textContent=t('Shared in the library. Future edits require sharing again.','已分享到作品库。后续编辑需要再次分享。');
   }catch(e){message.textContent=t('Not shared: ','未分享：')+e.message.replaceAll('_',' ');}finally{submit.disabled=!review.checked;}};d.showModal();
  }catch(e){state.textContent=e.message;}
 }
 function show(){
  if(!prepare())return;
  const d=dialog(t('Terrain gallery','作品画廊'),true),tabs=el('div',undefined,'terrain-tabs'),body=el('div',undefined,'terrain-gallery-body'),state=el('p');state.role='status';
  let mode='mine',generation=0,preview=null,cursor=null;
  const mine=button(t('My Terrains','我的作品'),()=>void render('mine')),shared=button(t('Shared library','共享作品库'),()=>void render('shared'));tabs.setAttribute('role','group');tabs.setAttribute('aria-label',t('Terrain collections','作品集合'));tabs.append(mine,shared);d.append(tabs,state,body);
  d.addEventListener('close',()=>{generation++;preview?.close();});
  function card(title,description,image,actions){const item=el('article',undefined,'terrain-card'),img=el('img');img.alt=t('Musical terrain preview','音乐作品预览');img.width=320;img.height=180;img.loading='lazy';if(image)img.src=image;const h=el('h3',title||t('Untitled','未命名'));item.append(img,h,el('p',description||''));const controls=el('div',undefined,'terrain-actions');controls.append(...actions);item.append(controls);return {item,img};}
  async function read(api,item){if(!UUID.test(item.id)||!UUID.test(item.version_id))throw Error('Invalid shared terrain identity.');const value=validateLibrarySnapshot(await api.request('/library/'+item.id+'?version_id='+item.version_id,{publicRead:true}));if(value.id!==item.id||value.version_id!==item.version_id)throw Error('Shared terrain version changed. Refresh the library.');return value;}
  async function details(api,item){
   const request=++generation;state.textContent=t('Loading shared terrain…','正在加载共享作品…');preview?.close();
   try{const value=await read(api,item);if(request!==generation||!d.open)return;body.replaceChildren();state.textContent='';body.append(button(t('← Back to shared library','← 返回共享作品库'),()=>void render('shared')),el('h3',value.title),el('p',value.description),el('p',value.attribution?`${t('By','作者')} ${value.attribution}`:''));const host=el('div',undefined,'terrain-play-preview');body.append(host);preview=previewTerrain(host,value.project);const copy=button(t('Make my own','创建我的改编'),()=>{if(createLocal(remixLibrarySnapshot({...value,schema:'melodymorph-library/1'})))d.close();else state.textContent=t('Local save failed. Your previous work is preserved.','本地保存失败，原有作品未更改。');});copy.disabled=!value.allow_remix;body.append(copy,el('p',value.allow_remix?t('Creates a new local copy and keeps your existing terrains. Guests do not upload anything.','创建新的本地副本并保留原有作品。访客不会上传任何内容。'):t('The creator allows playing this terrain, but has not permitted remixing.','作者允许演奏，但未允许改编。')));
   }catch(e){if(request===generation)state.textContent=e.message.replaceAll('_',' ');}
  }
  async function render(next=mode,more=false){
   mode=next;const request=++generation;preview?.close();preview=null;mine.setAttribute('aria-pressed',String(mode==='mine'));shared.setAttribute('aria-pressed',String(mode==='shared'));state.textContent='';if(!more){body.replaceChildren();cursor=null;}
   if(mode==='mine'){
    body.append(el('p',t('Saved on this browser. Saving does not share. Use Share to library only when you want others to see a snapshot.','保存在此浏览器中。保存不会分享；只有选择“分享到作品库”才会公开作品版本。')),button(t('New blank terrain','新建空白作品'),()=>{if(createLocal(blank()))d.close();}));
    const grid=el('div',undefined,'terrain-card-grid');body.append(grid);
    for(const summary of library.entries){const entry=library.value.entries.find(e=>e.id===summary.id),p=entry.project;const actions=[button(summary.active?t('Continue editing','继续编辑'):t('Open terrain','打开作品'),()=>{if(openLocal(entry.id))d.close();}),button(t('Share to library…','分享到作品库…'),()=>void share(entry.id,state))];const c=card(p.title,p.description,terrainThumbnail(p),actions);if(summary.active)c.item.dataset.current='true';if(p.library_origin||p.activity_origin){const origin=p.library_origin||p.activity_origin;c.item.append(el('small',`${t('Remixed from','改编自')} ${origin.title}${origin.attribution?' · '+origin.attribution:''}`));}grid.append(c.item);}
    return;
   }
   state.textContent=t('Loading shared library…','正在加载共享作品库…');
   try{
    const sync=await getCloud(),api=sync?.api;if(!api?.enabled||api.config.librarySharingEnabled!==true){state.textContent=t('Shared library is not enabled yet. My Terrains remains available locally. No guest terrain is uploaded.','共享作品库尚未启用。仍可使用本地“我的作品”。不会上传访客作品。');return;}
    let query=body.querySelector('[name=libraryQuery]');if(!query){const search=el('form',undefined,'terrain-search');query=field(search,'libraryQuery',t('Search shared titles, descriptions and authors','搜索共享标题、简介和作者'),'',100);const submit=el('button',t('Search','搜索'));submit.type='submit';search.append(submit);search.onsubmit=e=>{e.preventDefault();const q=query.value;void renderSearch(q);};body.append(search);}
    const result=await api.request('/library?q='+encodeURIComponent(query.value)+(cursor?'&cursor='+encodeURIComponent(cursor):''),{publicRead:true});if(request!==generation||!d.open)return;
    cursor=result.cursor;state.textContent=t('Shared snapshots from other creators. Browse and play without an account.','其他创作者主动分享的作品版本。无需账户即可浏览和演奏。');
    let grid=body.querySelector('.terrain-card-grid');if(!grid){grid=el('div',undefined,'terrain-card-grid');body.append(grid);}body.querySelector('[data-more]')?.remove();
    const pending=[];for(const item of result.items){const c=card(item.title,item.description,null,[button(t('Preview & play','预览和演奏'),()=>void details(api,item))]);if(item.attribution)c.item.append(el('small',item.attribution));grid.append(c.item);pending.push({item,img:c.img,card:c.item});}
    if(!grid.children.length)grid.append(el('p',t('No shared terrains on this page.','此页暂无共享作品。')));
    if(cursor){const more=button(t('Load more','加载更多'),()=>void render('shared',true));more.dataset.more='';body.append(more);}
    // Bound parallel reads. Images never execute playback or save the project.
    await Promise.all(Array.from({length:Math.min(3,pending.length)},async()=>{while(pending.length&&request===generation&&d.open){const {item,img,card}=pending.shift();try{const value=await read(api,item);if(request===generation&&d.open)img.src=terrainThumbnail(value.project);}catch{if(request===generation)card.append(el('small',t('Preview unavailable; refresh the library.','预览不可用，请刷新作品库。')));}}}));
   }catch(e){if(request===generation)state.textContent=t('Shared library unavailable: ','共享作品库暂不可用：')+e.message.replaceAll('_',' ');}
  }
  async function renderSearch(query){generation++;preview?.close();body.querySelector('.terrain-card-grid')?.remove();body.querySelector('[data-more]')?.remove();cursor=null;await render('shared',true);}
  d.showModal();void render();return d;
 }
 if(openButton)openButton.onclick=show;return {show};
}
