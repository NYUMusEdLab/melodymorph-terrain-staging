import {TerrainAPI} from './terrain-api.mjs';
import {previewTerrain} from './terrain-preview.mjs';
import {showActivityShare} from './activity-share.mjs';
const api=new TerrainAPI(),$=id=>document.getElementById(id);let cursor=null,current=null,preview=null,busy=false;
const element=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
const message=text=>$('message').textContent=text;
async function run(action){if(busy)return;busy=true;try{await action();}catch(e){message(e.message.replaceAll('_',' '));}finally{busy=false;}}
function button(text,action){const b=element('button',text);b.type='button';b.onclick=()=>void run(action);return b;}
function field(parent,label,type='text',value=''){const l=element('label',label),input=element(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;if(type==='checkbox')input.checked=!!value;else input.value=value;l.append(input);parent.append(l);return input;}
async function list(more=false){
  if(!api.canSave){message('Sign in to see private terrains.');return;}
  message('Searching…');
  if(!more){cursor=null;$('results').replaceChildren();}
  const query=new URLSearchParams({scope:$('scope').value,q:$('query').value,status:$('status').value});if(cursor)query.set('cursor',cursor);
  const data=await api.request('/terrains?'+query);cursor=data.cursor;$('more').hidden=!cursor;
  for(const item of data.items){const card=element('article');card.append(element('h2',item.title||'Untitled'),element('p',item.status+' · revision '+item.content_revision),element('p',item.attribution||'Attribution not supplied'),element('small',item.id),button('Preview & details',()=>open(item.id)));$('results').append(card);}
  message(cursor?'More records are available. Continue searching the next page.':$('results').children.length?'Collection loaded.':'No matching terrains.');
}
async function open(id){
  current=await api.request('/terrains/'+id);preview?.close();const root=$('detail');root.hidden=false;root.replaceChildren();
  root.append(element('h2',current.title||'Untitled'),element('p',current.status+' · content revision '+current.content_revision),element('code',current.id));
  const canvas=element('div');root.append(canvas);preview=previewTerrain(canvas,current.project);
  root.append(element('p','Authorship: '+(current.attribution||'Not supplied')));
  if(api.config.activitySharingEnabled&&api.signedIn&&(current.owned||api.me.staff&&current.allow_publication&&current.allow_remix))root.append(button('Share activity',()=>showActivityShare({api,terrain:current})));
  if(current.source)root.append(element('p','Derived from '+current.source.id+' · '+current.source.attribution));
  if(current.owned){
    const edit=element('a','Continue editing this terrain');edit.href='index.html?terrain='+encodeURIComponent(current.id);root.append(edit);
  }
  if(current.owned&&api.signedIn){
    const permissions=element('details'),summary=element('summary','Authorship, sharing & permissions');permissions.append(summary);root.append(permissions);
    const attribution=field(permissions,'Creator attribution (private; use an alias)','text',current.attribution);attribution.maxLength=100;
    const status=element('select');for(const value of ['draft','private','shared']){const o=element('option',value);o.value=value;status.append(o);}status.value=current.status==='published'?'private':current.status;const label=element('label','Visibility');label.append(status);permissions.append(label);
    const readers=field(permissions,'Shared reader account IDs, separated by commas','textarea',current.readers.join(', '));
    const allow=field(permissions,'I have authority to permit MusEDLab to publish this terrain after review.','checkbox',current.allow_publication);
    const remix=field(permissions,'Allow shared readers to make independent remixes.','checkbox',current.allow_remix);
    permissions.append(element('p','Saving permissions removes any map publication and requires a new review.'),button('Save permissions',async()=>{await api.request('/terrains/'+id,{method:'PATCH',body:{expected_revision:current.revision,status:status.value,attribution:attribution.value,readers:readers.value.split(',').map(v=>v.trim()).filter(Boolean),allow_publication:allow.checked,allow_remix:remix.checked}});await open(id);message('Permissions saved.');}));
  }
  if(api.signedIn&&(current.owned||current.allow_remix))root.append(button('Make an independent remix',async()=>{const copy=await api.request('/terrains/'+id+'/fork',{method:'POST',body:{expected_revision:current.revision,id:crypto.randomUUID()}});location.href='index.html?terrain='+copy.id;}));
  if(api.me.staff){
    const staff=element('section');root.append(staff);staff.append(element('h2','Staff review'));
    staff.append(element('p',current.review?current.review.decision+' · content revision '+current.review.content_revision:'Not reviewed'));
    const note=field(staff,'Private review note','textarea',current.review?.note||'');note.maxLength=1000;
    for(const decision of ['approved','rejected'])staff.append(button(decision==='approved'?'Approve this revision':'Reject this revision',async()=>{await api.request('/terrains/'+id+'/review',{method:'POST',body:{expected_revision:current.revision,decision,note:note.value}});await open(id);message('Review saved. This does not publish the terrain.');}));
    const publish=element('details');publish.append(element('summary','Publish approved revision to the world map'));staff.append(publish);
    publish.append(element('p','Choose public text deliberately. Original title, object labels and account identifiers are excluded. Drawings may contain identifying marks; they are excluded unless reviewed.'));
    const title=field(publish,'Public title');title.maxLength=100;const author=field(publish,'Public attribution or alias (optional)');author.maxLength=100;
    const region=element('select');for(const [value,label] of [['','No location'],['africa','Africa'],['asia','Asia'],['europe','Europe'],['north-america','North America'],['south-america','South America'],['oceania','Oceania']]){const option=element('option',label);option.value=value;region.append(option);}const regionLabel=element('label','Broad region only');regionLabel.append(region);publish.append(regionLabel);
    const ink=field(publish,'Include drawings: I reviewed them for identifying marks.','checkbox',false);
    const privacy=field(publish,'I reviewed this exact revision and public text for privacy and authorship.','checkbox',false);
    const publishButton=button('Publish to public map',async()=>{await api.request('/terrains/'+id+'/publish',{method:'POST',body:{expected_revision:current.revision,settings:{title:title.value,attribution:author.value,region:region.value||null,include_ink:ink.checked,privacy_reviewed:privacy.checked}}});await open(id);message('Published to the curated map.');});
    publishButton.disabled=!current.allow_publication||current.review?.decision!=='approved';publish.append(publishButton);
    if(!current.allow_publication)publish.append(element('p','Creator publication permission is required.'));
  }
  if((api.me.staff||current.owned)&&current.status==='published')root.append(button('Unpublish from world map',async()=>{await api.request('/terrains/'+id+'/unpublish',{method:'POST',body:{expected_revision:current.revision}});await open(id);message('Removed from the public feed.');}));
  if(api.signedIn&&(api.me.staff||current.owned))root.append(button('Show recent revision history',async()=>{const history=await api.request('/terrains/'+id+'/history');const pre=element('pre',JSON.stringify(history.items,null,2));root.append(pre);}));
  root.scrollIntoView({block:'start',behavior:'smooth'});
}
$('login').onclick=()=>void run(()=>api.signIn());$('logout').onclick=()=>{api.signOut();preview?.close();$('results').replaceChildren();$('detail').hidden=true;$('identity').textContent='';$('logout').hidden=true;$('login').hidden=false;message('Signed out.');};
$('search').onsubmit=e=>{e.preventDefault();void run(()=>list());};$('more').onclick=()=>void run(()=>list(true));window.addEventListener('pagehide',()=>preview?.close());
void run(async()=>{await api.init();$('login').disabled=!api.enabled;$('login').hidden=api.signedIn;$('logout').hidden=!api.signedIn;if(!api.enabled){message('Central storage awaits deployment. This page will connect when configured.');return;}if(!api.me){message('Sign in to browse private terrains.');return;}$('staffOption').hidden=!api.me.staff;if(api.me.staff)$('scope').value='admin';$('identity').textContent='Your sharing account ID: '+api.me.creator_id;const id=new URL(location.href).searchParams.get('id');await list();if(id)await open(id);});
