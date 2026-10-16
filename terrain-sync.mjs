// Local library is the durable outbox. Network work never runs in the music path.
import {validate} from './model.mjs';
const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])])):value;
export const fingerprint=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(ordered(value)))))).map(n=>n.toString(16).padStart(2,'0')).join('');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export class TerrainSync {
  constructor({library,api,storage,key,onState=()=>{},delay=1200}){
    Object.assign(this,{library,api,storage,key,onState,delay});this.busy=false;this.timer=null;this.retry=2000;this.conflicts=new Map();this.closed=false;
    try{this.ledger=JSON.parse(storage.getItem(key)||'{"entries":{}}');if(!this.ledger.entries||typeof this.ledger.entries!=='object'||Array.isArray(this.ledger.entries))throw Error();
      for(const entry of Object.values(this.ledger.entries))if(!entry||!uuid.test(entry.id)||!/^[a-f0-9]{64}$/.test(entry.owner)||!Number.isSafeInteger(entry.revision)||entry.revision<0||!(entry.hash===null||/^[a-f0-9]{64}$/.test(entry.hash)))throw Error();}
    catch{this.problem='Cloud sync settings could not be read. Local landscapes are safe; export a backup.';this.ledger={entries:{}};}
  }
  persistLedger(){try{this.storage.setItem(this.key,JSON.stringify(this.ledger));this.ledgerDirty=false;}catch(e){this.ledgerDirty=true;throw e;}}
  schedule(){if(this.closed||this.problem)return;clearTimeout(this.timer);this.timer=setTimeout(()=>void this.flush(),this.delay);}
  state(message){this.onState(message,this.conflicts);}
  async flush(){
    clearTimeout(this.timer);
    if(this.closed||this.busy||this.problem){if(this.problem)this.state(this.problem);return;}
    if(!this.api.enabled){this.state('Saved on this browser. Central storage awaits deployment.');return;}
    if(!(this.api.canSave??this.api.signedIn)||!this.api.me){this.state('Saved on this browser. Sign in again to resume account sync.');return;}
    if(this.library.readOnly||!this.library.saved){this.state('Central sync waits for a successful local save.');return;}
    this.busy=true;let pending=false,blocked=false;
    const owner=this.api.me.creator_id;
    try{
      if(this.ledgerDirty)this.persistLedger();
      // Snapshot the list, but re-read each current entry before sending it.
      for(const localId of this.library.value.entries.map(e=>e.id)){
        if(this.closed||this.api.me?.creator_id!==owner)break;
        const entry=this.library.value.entries.find(e=>e.id===localId);if(!entry)continue;
        // Browsing and remixing the public library never enrolls guest work in
        // uploads, even if a host separately enables guest storage later.
        if(this.api.me?.guest&&entry.project.library_origin)continue;
        let record=this.ledger.entries[localId];
        if(record&&record.owner!==owner){blocked=true;continue;}
        if(this.conflicts.has(localId)){blocked=true;continue;}
        if(!record){
          record=this.ledger.entries[localId]={id:uuid.test(localId)?localId:crypto.randomUUID(),owner,revision:0,hash:null};
          // Persist ownership before sending: another login must never claim this work.
          this.persistLedger();
        }
        const project=validate(entry.project),hash=await fingerprint(project);
        // Hashing yields to the UI. A sign-out/account switch must not send this
        // owner's pending content using the next account's credentials.
        if(this.closed||this.api.me?.creator_id!==owner){blocked=true;break;}
        if(hash===record.hash)continue;
        this.state('Saved locally. Syncing with MusEDLab…');
        let result;
        try{result=await this.api.request('/terrains/'+record.id,{method:'PUT',body:{expected_revision:record.revision,project}});}
        catch(error){
          if(error.status!==409)throw error;
          const remote=await this.api.request('/terrains/'+record.id);
          const remoteHash=await fingerprint(remote.project);
          if(remoteHash===hash){result=remote;}
          else if(record.hash&&remoteHash===record.hash){
            // Only permissions/review changed: content revision is still our parent.
            result=await this.api.request('/terrains/'+record.id,{method:'PUT',body:{expected_revision:remote.revision,project}});
          }else{this.conflicts.set(localId,{id:record.id,remote});blocked=true;continue;}
        }
        record.revision=result.revision;record.hash=hash;this.persistLedger();
        const latest=this.library.value.entries.find(e=>e.id===localId);
        if(latest&&await fingerprint(latest.project)!==hash)pending=true;
      }
      this.retry=2000;
      this.state(blocked?'Some landscapes need attention or belong to another account. Local copies are preserved.':pending?'Saved locally. More changes are waiting to sync.':'All eligible landscapes synced to MusEDLab. Publication requires separate permission and staff review.');
    }catch(error){
      const messages={401:'Sign in again to resume central sync.',413:'This terrain exceeds the 3 MB central limit. Export it; its local copy is preserved.',400:'This terrain could not be validated centrally. Export its local copy.',403:'Your account cannot sync this terrain.'};
      this.state(messages[error.status]||'Saved locally. Central sync is offline; retrying automatically.');
      if(![400,401,403,413].includes(error.status)){pending=true;this.retry=Math.min(this.retry*2,60000);}
    }finally{
      this.busy=false;
      if(pending&&!this.closed)this.timer=setTimeout(()=>void this.flush(),this.retry);
    }
  }
  async adopt(localId,remote){
    const record={id:remote.id,owner:this.api.me.creator_id,revision:remote.revision,hash:await fingerprint(remote.project)};
    this.ledger.entries[localId]=record;this.persistLedger();this.conflicts.delete(localId);
  }
  keepLocalAsNew(localId){
    const record=this.ledger.entries[localId];if(!record||record.owner!==this.api.me?.creator_id)return;
    this.ledger.entries[localId]={id:crypto.randomUUID(),owner:record.owner,revision:0,hash:null};
    this.persistLedger();this.conflicts.delete(localId);this.schedule();
  }
  close(){this.closed=true;clearTimeout(this.timer);}
}
