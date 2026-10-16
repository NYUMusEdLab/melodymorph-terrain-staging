import {LandscapeLibrary} from './landscape-library.mjs';
import {blank} from './model.mjs';
import {parseActivityLink,validateActivity,remixActivity} from './activity-snapshot.mjs';
import {readActivity} from './activity-read-api.mjs';
import {terrainConfig} from './terrain-config.mjs';
const STORE='melodymorph-workshop-landscape-v1';
export async function installSharedActivity({read=link=>readActivity(terrainConfig,link),storage={getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},key=STORE,navigate=url=>location.assign(url),hash=location.hash,player='index.html?activity-preview=1'}={}){
 const $=id=>document.getElementById(id),frame=$('activityPlayer');let activity=null,ready=false,loaded=false,busy=false,timeout;
 const show=message=>$('activityStatus').textContent=message;
 const send=()=>{if(activity&&ready)frame.contentWindow.postMessage({type:'melodymorph-activity-load',activity},location.origin);};
 window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.origin!==location.origin)return;if(event.data?.type==='melodymorph-activity-ready'){ready=true;send();}if(event.data?.type==='melodymorph-activity-loaded'&&event.data.version_id===activity?.version_id){loaded=true;clearTimeout(timeout);$('makeOwn').disabled=false;show('Play this activity. Make your own copy to change it.');}if(event.data?.type==='melodymorph-activity-error'){clearTimeout(timeout);show('This activity needs a compatible player.');}});
 const chooser=document.createElement('dialog');chooser.className='creation-dialog';chooser.setAttribute('aria-labelledby','creationTitle');chooser.setAttribute('aria-describedby','creationDescription');
 chooser.innerHTML='<h2 id="creationTitle">Make my own</h2><p id="creationDescription">Choose how to start. Your saved landscapes stay available on this browser.</p><div class="creation-options"><button type="button" data-start="blank"><strong>Start blank</strong><span>An empty canvas for a new idea.</span></button><button type="button" data-start="remix"><strong>Remix this activity</strong><span>Copy these bells, paths and phrases, with their source credit.</span></button></div><p data-creation-status role="status"></p><form method="dialog"><button class="cancel" value="cancel">Cancel</button></form>';
 for(const type of ['keydown','copy','cut','paste'])chooser.addEventListener(type,event=>event.stopPropagation());
 document.body.append(chooser);$('makeOwn').setAttribute('aria-haspopup','dialog');
 const choices=[...chooser.querySelectorAll('[data-start]')],choiceStatus=chooser.querySelector('[data-creation-status]');
 $('makeOwn').onclick=()=>{if(!activity||!loaded||busy||chooser.open)return;choiceStatus.textContent='';chooser.showModal();};
 for(const button of choices)button.onclick=()=>{
  if(!activity||!loaded||busy||!chooser.open)return;
  busy=true;$('makeOwn').disabled=true;for(const choice of choices)choice.disabled=true;
  const isBlank=button.dataset.start==='blank';
  try{
   const library=new LandscapeLibrary({storage,key:key+':library-v1',legacyKey:key}),result=library.create(library.current,isBlank?blank():remixActivity(activity));
   if(!result.ok)throw Error('Your landscape could not be saved. Your existing landscapes are unchanged. Check browser storage, then try again.');
  }catch(error){choiceStatus.textContent=error.message;busy=false;$('makeOwn').disabled=false;for(const choice of choices)choice.disabled=false;return;}
  show(isBlank?'Your blank landscape is saved on this browser.':'Your independent copy is saved on this browser.');chooser.close();navigate(new URL('./',location.href).href);
 };
 try{const link=parseActivityLink(hash);activity=validateActivity(await read(link));if(activity.activity_id!==link.activity_id)throw Error('The activity does not match this link.');$('activityTitle').textContent=activity.title;$('activityAttribution').textContent=activity.attribution?('By '+activity.attribution):'Shared musical activity';$('activityVersion').textContent='Version '+activity.version_id.slice(0,8);frame.hidden=false;frame.src=player;send();timeout=setTimeout(()=>{if(!loaded)show('The player is taking longer to load. Reload this page to try again.');},20000);return activity;}catch(error){show(error.message||'This activity could not be loaded.');frame.hidden=true;return null;}
}
if(!document.documentElement.hasAttribute('data-activity-test'))installSharedActivity();
