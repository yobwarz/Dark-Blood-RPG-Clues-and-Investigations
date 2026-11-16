import {ID,empty,copy,esc,apply,project} from './model.mjs';
export const all=c=>c?.contents??Array.from(c?.values?.()??c??[]);
export const activeGM=()=>!!game.user?.isGM&&game.users.activeGM?.id===game.user.id;
const PAGE='Dados de investigação';
const getSetting=k=>game.settings.get(ID,k);
const encode=s=>'<pre>'+esc(JSON.stringify(s))+'</pre>';
const decode=s=>s.replace(/^\s*<pre[^>]*>/,'').replace(/<\/pre>\s*$/,'').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&');
const page=d=>all(d?.pages).find(p=>p.name===PAGE);
const gm=()=>{if(!activeGM())throw Error('Esta operação exige o Mestre ativo.');};
export const database=()=>game.journal.get(getSetting('database'));
let chain=Promise.resolve();export const queue=fn=>{const p=chain.catch(()=>{}).then(fn);chain=p;return p;};
function privateDocument(d){if((d.ownership?.default??0)!==0||all(game.users).some(u=>!u.isGM&&(d.ownership?.[u.id]??0)>0))throw Error('O diário de investigação deve permanecer privado aos Mestres. Corrija suas permissões antes de continuar.');const p=page(d);if(!p)throw Error('Página de investigação removida. Restaure o backup.');if((p.ownership?.default??-1)>0||all(game.users).some(u=>!u.isGM&&(p.ownership?.[u.id]??-1)>0))throw Error('A página de investigação deve permanecer privada.');return p;}
async function folder(){gm();let f=all(game.folders).find(f=>f.type==='JournalEntry'&&f.flags?.[ID]?.storage);if(!f)f=await Folder.create({name:'Pistas e Investigações',type:'JournalEntry',flags:{[ID]:{storage:true}}});return f.id;}
export async function ensure(){
 gm();let d=database();const id=getSetting('database');
 if(id&&!d)throw Error('O diário de investigação foi removido. Restaure-o do backup; os dados não serão reiniciados.');
 if(!d){const found=all(game.journal).filter(x=>x.flags?.[ID]?.database);if(found.length>1)throw Error('Há mais de um diário de investigação. Confira a origem antes de continuar.');d=found[0];if(!d)d=await JournalEntry.create({name:'Pistas e Investigações — Arquivo do Mestre',folder:await folder(),ownership:{default:0},flags:{[ID]:{database:true}},pages:[{name:PAGE,type:'text',ownership:{default:-1},text:{format:1,content:encode(empty())}}]});privateDocument(d);gm();await game.settings.set(ID,'database',d.id);}
 if(!d.flags?.[ID]?.database)throw Error('O diário configurado não pertence a este módulo.');privateDocument(d);return d;
}
export function read(){if(!game.user.isGM)throw Error('Arquivo reservado ao Mestre.');const d=database();if(!d){if(getSetting('database'))throw Error('Arquivo de investigação indisponível. Restaure o backup.');return empty();}const p=privateDocument(d),s=JSON.parse(decode(p.text.content));if(s.schema!==1||!Array.isArray(s.cases)||!s.receipts||!Number.isSafeInteger(s.revision))throw Error('Formato do arquivo de investigação inválido.');return s;}
export function view(){
 if(game.user.isGM)return project(read(),game.user);
 const id=getSetting('views')?.[game.user.id],d=game.journal.get(id);if(!d||d.flags?.[ID]?.viewFor!==game.user.id)return {schema:1,revision:0,cases:[]};
 const p=page(d);if(!p)return {schema:1,revision:0,cases:[]};const s=JSON.parse(decode(p.text.content));if(s.schema!==1||!Array.isArray(s.cases))throw Error('Visão de investigação inválida. Solicite sincronização ao Mestre.');return s;
}
async function writeView(user,data){
 gm();const map=copy(getSetting('views')??{});let d=game.journal.get(map[user.id]);
 if(d&&d.flags?.[ID]?.viewFor!==user.id)throw Error('O diário de visão não corresponde ao jogador.');
 if(!d){const found=all(game.journal).filter(x=>x.flags?.[ID]?.viewFor===user.id);if(found.length>1)throw Error('Há visões duplicadas para '+user.name+'. Confira os diários.');d=found[0];if(!d)d=await JournalEntry.create({name:'Pistas e Investigações — '+user.name,folder:await folder(),ownership:{default:0,[user.id]:2},flags:{[ID]:{viewFor:user.id}},pages:[{name:PAGE,type:'text',ownership:{default:-1},text:{format:1,content:encode(data)}}]});map[user.id]=d.id;gm();await game.settings.set(ID,'views',map);}
 const ownership={default:0,[user.id]:2};if(JSON.stringify(d.ownership)!==JSON.stringify(ownership)){gm();await d.update({ownership});}
 const p=page(d);if(!p)throw Error('Página da visão de '+user.name+' removida.');if(JSON.stringify(p.ownership??{})!==JSON.stringify({default:-1})){gm();await p.update({ownership:{default:-1}});}
 const content=encode(data);if(p.text.content!==content){gm();await p.update({'text.content':content});}
}
export async function publish(){gm();await ensure();const s=read(),errors=[];for(const user of all(game.users).filter(u=>!u.isGM)){try{await writeView(user,project(s,{id:user.id,isGM:false}));}catch(e){errors.push(user.name+': '+e.message);}}Hooks.callAll('investigacoes.refresh');if(errors.length)throw Error('Dados salvos; sincronização pendente. '+errors.join(' · '));return s.revision;}
export function needsSync(){if(!game.user.isGM)return false;const revision=read().revision;return all(game.users).some(u=>{if(u.isGM)return false;const d=game.journal.get(getSetting('views')?.[u.id]),p=page(d);if(!p)return true;try{return JSON.parse(decode(p.text.content)).revision!==revision;}catch{return true;}});}
export async function execute(op,data,user,key,nonce=null){return queue(async()=>{
 gm();await ensure();const canonical=game.users.get(user?.id);if(!canonical||canonical!==user||!canonical.active)throw Error('Solicitante não autenticado ou desconectado.');const s=read(),intent=nonce?'intent:'+user.id+':'+nonce:null;if(Object.hasOwn(s.receipts,key)||intent&&Object.hasOwn(s.receipts,intent)){try{await publish();return {saved:true};}catch(e){return {saved:true,pending:true,message:e.message};}}
 const next=apply(s,op,copy(data),canonical,{users:all(game.users),uid:()=>foundry.utils.randomID(),time:Number(game.time.worldTime??0),allowTheories:getSetting('allowTheories')});next.receipts[key]=true;if(intent)next.receipts[intent]=true;gm();const p=privateDocument(database());try{await p.update({'text.content':encode(next)});}catch(error){if(!Object.hasOwn(read().receipts,key))throw error;}
 // Um veto de gravação não pode ser tratado como sucesso.
 if(!Object.hasOwn(read().receipts,key))throw Error('A gravação foi recusada. Nenhum resultado foi confirmado.');
 try{await publish();return {saved:true};}catch(e){return {saved:true,pending:true,message:e.message};}
});}
export async function command(op,data={},options={}){
 const nonce=options.requestId??foundry.utils.randomID();if(!/^[A-Za-z0-9_-]{8,80}$/.test(nonce))throw Error('Identificador da solicitação inválido.');
 if(activeGM()){const r=await execute(op,data,game.user,'local.'+nonce,nonce);if(r.pending)ui.notifications.warn(r.message);return r;}
 if(!game.users.activeGM)throw Error('É necessário um Mestre conectado para salvar. Nenhuma alteração foi enviada.');
 return ChatMessage.create({user:game.user.id,whisper:[...new Set([game.users.activeGM.id,game.user.id])],content:'<p>Pistas e Investigações — solicitação em processamento.</p>',flags:{[ID]:{request:{op,data:copy(data),nonce},status:'pending'}}});
}
export async function processMessage(message,options,creatorId){
 if(!activeGM())return;const m=game.messages.get(message?.id);if(!m||m.documentName!=='ChatMessage'||!m.flags?.[ID]?.request)return;
 if(!creatorId||m.author?.id!==creatorId||m.uuid!==message.uuid)return false;
 const user=game.users.get(creatorId),r=copy(m.flags[ID].request);
 try{
  if(!r||Object.keys(r).some(k=>!['op','data','nonce'].includes(k))||typeof r.op!=='string'||!/^[A-Za-z0-9_-]{8,80}$/.test(r.nonce??'')||JSON.stringify(r).length>28000)throw Error('Solicitação inválida.');
  const result=await execute(r.op,r.data??{},user,m.uuid,r.nonce);
  await m.update({['flags.'+ID+'.status']:'done',content:'<p>Pistas e Investigações — salvo.'+(result.pending?' O Mestre precisa sincronizar as visões.':'')+'</p>'});
 }catch(e){
  // Resposta perdida depois do commit não permite repetir a operação como se nada tivesse ocorrido.
  let saved=false;try{saved=Object.hasOwn(read().receipts,m.uuid);}catch{}
  await m.update({['flags.'+ID+'.status']:saved?'done':'rejected',content:'<p>Pistas e Investigações — '+(saved?'salvo; confira a sincronização.':esc(e.message))+'</p>'});
  ui.notifications.warn(e.message);
 }
}
export async function boot(){if(!activeGM())return;return queue(async()=>{
 await ensure();await publish();
 for(const m of all(game.messages).filter(m=>m.flags?.[ID]?.request&&m.flags[ID].status==='pending')){
  const receipts=read().receipts,nonce=m.flags[ID].request?.nonce,saved=Object.hasOwn(receipts,m.uuid)||/^[A-Za-z0-9_-]{8,80}$/.test(nonce??'')&&Object.hasOwn(receipts,'intent:'+m.author?.id+':'+nonce);await m.update({['flags.'+ID+'.status']:saved?'done':'rejected',content:'<p>Pistas e Investigações — '+(saved?'salvo.':'solicitação antiga não reaplicada. Confira o quadro antes de reenviar.')+'</p>'});
 }
});}
