import {TerrainAPI} from './terrain-api.mjs';
import {TerrainSync,fingerprint} from './terrain-sync.mjs';
import {showActivityShare} from './activity-share.mjs';
export async function installTerrainCloud({library,key,loadRemote,prepareShare}){
  const host=document.querySelector('.landscape-library');if(!host)return;
  const section=document.createElement('section');section.className='terrain-cloud';section.dataset.noTranslate='';
  const title=document.createElement('h2');title.textContent='MusEDLab terrain library · 中央作品库';
  const notice=document.createElement('p');notice.textContent='When enabled, landscapes save automatically for you and authorized MusEDLab staff. Guest storage uses a private browser key without requesting an account name or device location. Map publication needs your permission and staff review.';
  const state=document.createElement('p');state.role='status';state.textContent='Checking central storage…';
  const actions=document.createElement('div');actions.className='library-actions';
  const signIn=document.createElement('button');signIn.textContent='Sign in';
  const claim=document.createElement('button');claim.textContent='Claim guest terrains';claim.hidden=true;
  const share=document.createElement('button');share.textContent='Share activity';share.hidden=true;
  const retry=document.createElement('button');retry.textContent='Retry sync';
  const signOut=document.createElement('button');signOut.textContent='Sign out';
  const catalog=document.createElement('a');catalog.href='terrain-catalog.html';catalog.textContent='Open central library';
  const map=document.createElement('a');map.href='terrain-world.html';map.textContent='Explore curated world map';
  const conflicts=document.createElement('div');
  actions.append(signIn,retry,signOut,claim,share);section.append(title,notice,state,actions,catalog,document.createTextNode(' · '),map,conflicts);host.after(section);
  let api,sync,initialize,bootTimer;
  const resume=async()=>{clearTimeout(bootTimer);try{if(!api.me)await initialize();else await sync.flush();}catch{state.textContent='Saved locally. Sign-in service is offline; central sync will retry.';bootTimer=setTimeout(resume,10000);}};
  try{
    api=new TerrainAPI();
    sync=new TerrainSync({library,api,storage:localStorage,key:key+':cloud-v1',onState:(message,items)=>{
      state.textContent=message;conflicts.replaceChildren();
      for(const [localId,item] of items){
        const p=document.createElement('p');p.textContent='Cloud conflict: '+(library.value.entries.find(e=>e.id===localId)?.project.title||localId);
        const keep=document.createElement('button');keep.textContent='Preserve local work as a new terrain';keep.onclick=()=>{try{sync.keepLocalAsNew(localId);}catch{state.textContent='Unable to record this choice. Export your local work.';}};
        const link=document.createElement('a');link.href='terrain-catalog.html?id='+encodeURIComponent(item.id);link.textContent='Review cloud version';p.append(keep,link);conflicts.append(p);
      }
    }});
    const original=library.commit.bind(library);
    library.commit=value=>{const result=original(value);if(result.ok)sync.schedule();return result;};
    retry.onclick=()=>void resume();
    signIn.onclick=()=>void api.signIn().catch(e=>state.textContent=e.message);
    signOut.onclick=async()=>{api.signOut();signOut.hidden=true;signIn.hidden=false;claim.hidden=true;share.hidden=true;try{await api.startGuest();await sync.flush();}catch{state.textContent='Signed out. Local work is preserved; central sync is unavailable.';}};
    share.onclick=async()=>{share.disabled=true;try{
      const localId=prepareShare();if(!localId)throw Error('Save this terrain before sharing.');
      if(sync.busy)throw Error('Central sync is running. Try Share activity again after it finishes.');
      await sync.flush();const record=sync.ledger.entries[localId],entry=library.value.entries.find(e=>e.id===localId);
      if(!record||record.owner!==api.me.creator_id||record.hash!==await fingerprint(entry.project)||sync.conflicts.has(localId)||sync.ledgerDirty)throw Error('Sync this terrain successfully before sharing.');
      const terrain=await api.request('/terrains/'+record.id);showActivityShare({api,terrain});
    }catch(e){state.textContent=e.message.replaceAll('_',' ');}finally{share.disabled=false;}};
    claim.onclick=async()=>{claim.disabled=true;try{
      const guest=await api.startGuest(false);let count=0;
      for(const record of Object.values(sync.ledger.entries)){
        if(record.owner!==guest.creator_id)continue;
        let remote;try{remote=await api.request('/terrains/'+record.id,{useGuest:true});}
        catch(e){if(e.status!==404)throw e;try{remote=await api.request('/terrains/'+record.id);}catch(lookup){if(lookup.status!==404||record.revision!==0)throw lookup;record.owner=api.me.creator_id;sync.persistLedger();count++;continue;}}
        const result=await api.request('/terrains/'+record.id+'/claim',{method:'POST',claimGuest:true,body:{expected_revision:remote.revision}});
        record.owner=api.me.creator_id;record.revision=result.revision;sync.persistLedger();count++;
      }
      state.textContent=count+' guest terrains claimed. Stable IDs and authorship history were preserved.';sync.schedule();
    }catch(e){state.textContent=e.message.replaceAll('_',' ');}finally{claim.disabled=false;}};
    initialize=async()=>{
    await api.init();signIn.hidden=api.signedIn;signIn.disabled=!api.enabled;signOut.hidden=!api.signedIn;claim.hidden=!api.signedIn;
    share.hidden=!api.signedIn||api.config.activitySharingEnabled!==true;
    const url=new URL(location.href),terrainId=url.searchParams.get('terrain');
    if(terrainId&&api.canSave){
      const remote=await api.request('/terrains/'+encodeURIComponent(terrainId));
      if(!remote.owned)throw Error('Open this terrain in the library preview; only its creator can edit it.');
      const match=Object.entries(sync.ledger.entries).find(([,entry])=>entry.id===remote.id&&entry.owner===api.me.creator_id);
      const local=match&&library.value.entries.find(e=>e.id===match[0]);
      if(local&&await fingerprint(local.project)!==match[1].hash)throw Error('This browser has unsynced changes. Sync or preserve them as a new terrain before loading the cloud version.');
      const localId=loadRemote(remote.project,match?.[0]);
      if(!localId)throw Error('Cloud terrain was not opened because local storage could not save it.');
      await sync.adopt(localId,remote);url.searchParams.delete('terrain');history.replaceState(null,'',url);
    }
    sync.schedule();
    };
    window.addEventListener('online',()=>void resume());window.addEventListener('pagehide',()=>{sync.close();clearTimeout(bootTimer);},{once:true});
    window.addEventListener('pageshow',e=>{if(e.persisted){sync.closed=false;sync.schedule();}});
    await initialize();
  }catch(e){state.textContent=e.message||'Central storage is unavailable. Local landscapes remain usable.';if(api?.enabled&&!api.me&&initialize)bootTimer=setTimeout(resume,10000);}
  return sync;
}
