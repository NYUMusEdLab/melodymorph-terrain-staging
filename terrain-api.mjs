import {terrainConfig} from './terrain-config.mjs';
const SESSION='melodymorph-terrain-auth-v1', FLOW=SESSION+':flow';
const encode=bytes=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export class ApiError extends Error {constructor(code,status){super(code);this.status=status;}}
export class TerrainAPI {
  constructor({config=terrainConfig,fetcher=globalThis.fetch?.bind(globalThis),session=globalThis.sessionStorage,storage=globalThis.localStorage}={}){
    this.config=config;this.fetcher=fetcher;this.session=session;this.storage=storage;this.token=null;this.expires=0;this.me=null;this.guestKey=null;
  }
  get enabled(){return this.config.enabled===true;}
  get signedIn(){return !!this.token&&Date.now()<this.expires;}
  get canSave(){return this.signedIn||!!this.me?.guest;}
  async init(){
    if(!this.enabled)return;
    for(const key of ['apiBase','authDomain','issuer','redirectUri']){const u=new URL(this.config[key]);if(u.protocol!=='https:')throw Error('Terrain configuration requires HTTPS.');}
    const here=new URL(location.href),code=here.searchParams.get('code');
    if(code||here.searchParams.has('error')){
      const raw=this.session.getItem(FLOW);this.session.removeItem(FLOW);
      const state=raw?JSON.parse(raw):null;
      // Erase authorization response before any API calls or UI links.
      const returned=here.searchParams.get('state'),failure=here.searchParams.get('error');
      here.searchParams.delete('code');here.searchParams.delete('state');here.searchParams.delete('error');here.searchParams.delete('error_description');history.replaceState(null,'',here);
      if(!state||state.state!==returned||Date.now()-state.at>600000)throw Error('Sign-in expired. Please sign in again.');
      if(failure)throw Error('Sign-in was not completed.');
      const body=new URLSearchParams({grant_type:'authorization_code',client_id:this.config.clientId,code,redirect_uri:this.config.redirectUri,code_verifier:state.verifier});
      const result=await this.fetcher(this.config.authDomain+'/oauth2/token',{method:'POST',body,credentials:'omit',referrerPolicy:'no-referrer'});
      if(!result.ok)throw Error('Sign-in could not be completed.');
      const token=await result.json();
      if(typeof token.access_token!=='string'||!Number.isFinite(token.expires_in))throw Error('Invalid sign-in response.');
      this.session.setItem(SESSION,JSON.stringify({token:token.access_token,expires:Date.now()+token.expires_in*1000-30000}));
      // No refresh token is persisted. The managed login can start a new short session.
      if(state.returnPath&&state.returnPath!==location.pathname+location.search){location.replace(state.returnPath);return;}
    }
    const saved=JSON.parse(this.session.getItem(SESSION)||'null');
    if(saved){this.token=saved.token;this.expires=saved.expires;}
    if(this.signedIn)this.me=await this.request('/me');else await this.startGuest();
  }
  async startGuest(activate=true){
    if(!this.enabled)return;
    let key=this.storage.getItem(SESSION+':guest');
    if(this.config.guestEnabled!==true&&activate)return;
    if(this.config.guestEnabled!==true&&!key)throw new ApiError('guest_storage_disabled',403);
    if(key&&!/^[A-Za-z0-9_-]{43}$/.test(key))throw Error('The browser storage key is damaged. Export local work before resetting it.');
    if(!key){key=encode(crypto.getRandomValues(new Uint8Array(32)));this.storage.setItem(SESSION+':guest',key);}
    this.guestKey=key;
    // Compute the pseudonym locally so first-load offline work can queue immediately.
    // The server independently derives this ID from the capability on every request.
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('melodymorph-guest\0'+key));
    const me={creator_id:Array.from(new Uint8Array(bytes)).map(v=>v.toString(16).padStart(2,'0')).join(''),staff:false,guest:true};
    if(activate)this.me=me;return me;
  }
  async signIn(){
    if(!this.enabled)throw Error('Central storage is not configured.');
    const verifier=encode(crypto.getRandomValues(new Uint8Array(32))),state=encode(crypto.getRandomValues(new Uint8Array(32)));
    const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
    this.session.setItem(FLOW,JSON.stringify({verifier,state,at:Date.now(),returnPath:location.pathname+location.search}));
    const url=new URL(this.config.authDomain+'/oauth2/authorize');
    url.search=new URLSearchParams({response_type:'code',client_id:this.config.clientId,redirect_uri:this.config.redirectUri,scope:this.config.scope,state,code_challenge:challenge,code_challenge_method:'S256'});
    location.assign(url);
  }
  signOut(){this.token=null;this.expires=0;this.me=null;this.session.removeItem(SESSION);}
  async request(path,{method='GET',body,publicRead=false,useGuest=false,claimGuest=false}={}){
    if(!this.enabled)throw new ApiError('storage_not_configured',503);
    useGuest=!publicRead&&(useGuest||this.me?.guest===true);
    if(!publicRead&&!useGuest&&!this.signedIn)throw new ApiError('sign_in_required',401);
    if(useGuest&&!this.guestKey)throw new ApiError('guest_key_required',401);
    const headers={};if(!publicRead)headers.Authorization='Bearer '+(useGuest?this.guestKey:this.token);
    if(useGuest)path='/guest'+path;
    if(claimGuest){if(!this.signedIn||!this.guestKey)throw new ApiError('sign_in_required',401);headers['X-Terrain-Guest']=this.guestKey;}
    if(body!==undefined)headers['Content-Type']='application/json';
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const r=await this.fetcher(this.config.apiBase.replace(/\/$/,'')+'/terrain/v1'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal});
      const data=await r.json();if(!r.ok)throw new ApiError(data.error||'service_unavailable',r.status);return data;
    }finally{clearTimeout(timer);}
  }
}
