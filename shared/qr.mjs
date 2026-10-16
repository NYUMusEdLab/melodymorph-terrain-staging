import {qrcodegen} from './vendor/qrcodegen.mjs';
export function qrMatrix(text){
 const qr=qrcodegen.QrCode.encodeText(text,qrcodegen.QrCode.Ecc.MEDIUM);
 return Array.from({length:qr.size},(_,y)=>Array.from({length:qr.size},(_,x)=>qr.getModule(x,y)));
}
export function drawQr(canvas,text,scale=8){
 const matrix=qrMatrix(text),quiet=4,size=matrix.length+quiet*2;
 canvas.width=canvas.height=size*scale;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Canvas unavailable');
 ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#000';
 matrix.forEach((row,y)=>row.forEach((dark,x)=>{if(dark)ctx.fillRect((x+quiet)*scale,(y+quiet)*scale,scale,scale);}));
 return {modules:matrix.length,quiet,scale};
}
