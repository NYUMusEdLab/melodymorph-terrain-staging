import {SampleBank,SAMPLE_MAP} from './samples.mjs';
// Sample loading reuses the approved MusEDLab player. Voices use explicit Web Audio
// sources/envelopes so every scheduled note can be released and disconnected.
export class Sound {
  constructor(onEvent,onEnd,options={}){this.onEvent=onEvent;this.onEnd=onEnd;this.groups=new Map();this.pending=[];this.voices=new Set();this.epoch=0;this.serial=0;this.samples=new SampleBank(options.onSampleStatus,options.loader,options.timeout);}
  async unlock(){
    const epoch=this.epoch;
    if(!this.ctx){const AC=globalThis.AudioContext||globalThis.webkitAudioContext;this.ctx=new AC({latencyHint:'interactive'});}
    if(!this.master){this.master=this.ctx.createGain();this.master.gain.value=.35;const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=12;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.18;this.master.connect(limiter);limiter.connect(this.ctx.destination);}
    if(this.ctx.state!=='running')await this.ctx.resume();
    if(epoch!==this.epoch||this.ctx.state!=='running')return false;
    // Loading never queues a delayed note. Immediate fallback keeps gestures timed.
    void this.samples.prepare(this.ctx,this.master);return true;
  }
  get ready(){return !!this.master&&this.ctx?.state==='running';}
  get now(){return this.ctx?.currentTime??0;}
  tone(e,time,group){
    time=Math.max(this.now,time);const sample=this.samples.get(e.timbre,e.midi),config=SAMPLE_MAP[e.timbre];
    const source=sample?.buffer?this.ctx.createBufferSource():this.ctx.createOscillator(),gain=this.ctx.createGain();
    let duration,level,release;
    if(sample?.buffer){source.buffer=sample.buffer;source.loop=false;duration=Math.min(sample.buffer.duration,e.duration??config.duration);release=Math.min(config.release,duration/3);level=sample.gain;}
    else{source.type=e.timbre==='pluck'?'triangle':'sine';source.frequency.value=440*2**((e.midi-69)/12);duration=e.duration??(e.timbre==='vibes'?1.4:e.timbre==='pluck'?.45:.85);release=Math.min(.12,duration/3);level=.20;}
    duration=Math.max(.03,duration);gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(level,time+.006);
    if(sample?.buffer){gain.gain.setValueAtTime(level,time+Math.max(.007,duration-release));gain.gain.linearRampToValueAtTime(0,time+duration);}
    else{gain.gain.exponentialRampToValueAtTime(.0001,time+duration);}
    source.connect(gain);gain.connect(this.master);
    const voice={source,gain,group,stopped:false};this.voices.add(voice);
    source.onended=()=>{this.voices.delete(voice);source.disconnect();gain.disconnect();};
    source.start(time);source.stop(time+duration+.01);
    if(this.voices.size>64)this.releaseVoice(this.voices.values().next().value);
    return voice;
  }
  releaseVoice(voice){if(voice.stopped)return;voice.stopped=true;const at=this.now;try{voice.gain.gain.cancelScheduledValues(at);voice.gain.gain.setTargetAtTime(0,at,.003);voice.source.stop(at+.02);}catch{}this.voices.delete(voice);}
  note(e,id,at=this.now){this.tone(e,Math.max(this.now,at),id);this.onEvent(e,at,id);}
  play(bell){
    if(this.groups.has(bell.id)){this.stopGroup(bell.id);return;}
    const start=this.now+.025;
    const group={id:bell.id,end:start+bell.events.at(-1).time+.06};this.groups.set(bell.id,group);
    for(const e of bell.events)this.pending.push({event:e,at:start+e.time,group:bell.id,scheduled:false});
    this.pending.sort((a,b)=>a.at-b.at);this.tick();
  }
  tick(){
    if(this.timer)return;
    this.timer=setInterval(()=>{
      const now=this.now;
      for(const p of this.pending){if(!p.scheduled && p.at<now+.07){this.tone(p.event,Math.max(now,p.at),p.group);p.scheduled=true;}}
      const due=this.pending.filter(p=>p.at<=now);this.pending=this.pending.filter(p=>p.at>now);
      for(const p of due)if(this.groups.has(p.group))this.onEvent(p.event,p.at,p.group);
      for(const [id,g] of this.groups)if(g.end<=now){this.groups.delete(id);this.onEnd(id);}
      if(!this.pending.length&&!this.groups.size){clearInterval(this.timer);this.timer=null;}
    },12);
  }
  stopGroup(id){this.pending=this.pending.filter(p=>p.group!==id);this.groups.delete(id);for(const v of this.voices)if(v.group===id)this.releaseVoice(v);this.onEnd(id);}
  stop(){this.epoch++;this.pending=[];for(const id of [...this.groups.keys()])this.stopGroup(id);for(const v of this.voices)this.releaseVoice(v);clearInterval(this.timer);this.timer=null;}
}
