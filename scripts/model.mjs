export const ID='sangue-escuro-investigacoes';
export const TYPES={evidencia:'Evidência',fotografia:'Fotografia',depoimento:'Depoimento',documento:'Documento',pessoa:'Pessoa',local:'Local',nota:'Nota'};
export const STATES={aberto:'Em investigação',resolvido:'Resolvido',arquivado:'Arquivado'};
export const ANALYSIS={nova:'Não examinada',analise:'Em análise',analisada:'Analisada'};
export const copy=x=>structuredClone(x);
export const empty=()=>({schema:1,revision:0,cases:[],receipts:{}});
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function text(v,max=200,required=false){if(typeof v!=='string')throw Error('Texto inválido.');const s=v.trim();if(s.length>max||required&&!s)throw Error(required?`Preencha o texto (até ${max} caracteres).`:`Use até ${max} caracteres.`);return s;}
export function asset(v){const s=text(v??'',1800);if(!s)return '';if(/[\u0000-\u001f<>"'\\]/.test(s)||s.startsWith('//')||s.split('/').includes('..')||/^[a-z][a-z0-9+.-]*:/i.test(s)&&!/^https?:\/\//i.test(s))throw Error('Escolha uma imagem do Foundry ou endereço HTTP/HTTPS.');return s;}
export function audience(v,users){if(!Array.isArray(v)||v.some(x=>typeof x!=='string'))throw Error('Destinatários inválidos.');if(v.includes('*'))return ['*'];if(v.some(id=>!users.some(u=>u.id===id&&!u.isGM)))throw Error('Jogador não encontrado.');return [...new Set(v)];}
export const canSee=(aud,user)=>!!user?.isGM||Array.isArray(aud)&&(aud.includes('*')||aud.includes(user?.id));
export function position(v){if(!v||!Number.isFinite(v.x)||!Number.isFinite(v.y)||v.x<0||v.y<0||v.x>6000||v.y>6000)throw Error('Posição fora do quadro.');return {x:Math.round(v.x),y:Math.round(v.y)};}
export function checkRevision(record,n){if(!Number.isSafeInteger(n)||n!==record.revision)throw Error('Este registro mudou. Reabra o editor para preservar as alterações.');}
export function project(s,user){
 if(user.isGM)return copy({schema:1,revision:s.revision,cases:s.cases});
 const cases=[];
 for(const c of s.cases){
  if(!canSee(c.audience,user))continue;
  const clues=c.clues.filter(p=>canSee(p.audience,user)).map(p=>({id:p.id,revision:p.revision,type:p.type,name:p.name,text:p.text,img:p.img,tags:copy(p.tags),analysis:p.analysis,position:copy(p.position)}));
  const visible=new Set(clues.map(p=>p.id));
  const links=c.links.filter(l=>canSee(l.audience,user)&&visible.has(l.from)&&visible.has(l.to)).map(l=>({id:l.id,revision:l.revision,from:l.from,to:l.to,label:l.label,kind:l.kind}));
  cases.push({id:c.id,revision:c.revision,name:c.name,intro:c.intro,status:c.status,clues,links,note:copy(c.notes?.[user.id]??{text:'',revision:0}),theories:c.theories.filter(t=>t.author===user.id).map(t=>({id:t.id,from:t.from,to:t.to,label:t.label,text:t.text,status:t.status,feedback:t.feedback??''}))});
 }
 return {schema:1,revision:s.revision,cases};
}
const has=(map,k)=>Object.hasOwn(map,k);
function keys(d,allowed){if(!d||Object.getPrototypeOf(d)!==Object.prototype||Object.keys(d).some(k=>!allowed.includes(k)))throw Error('Campos da operação inválidos.');}
const contracts={caseSave:['id','revision','name','intro','private','status','audience'],caseDelete:['caseId','revision'],clueSave:['caseId','id','revision','type','name','text','private','img','tags','analysis','audience','sourceUuid'],clueDelete:['caseId','id','revision'],move:['caseId','id','revision','position'],linkSave:['caseId','id','revision','from','to','label','private','kind','audience'],linkDelete:['caseId','id','revision'],share:['caseId','kind','id','revision','audience'],noteSave:['caseId','revision','text'],theoryCreate:['caseId','from','to','label','text'],theoryDelete:['caseId','id'],theoryResolve:['caseId','id','decision','feedback','audience','kind']};
export function apply(state,op,data,user,env){
 if(!has(contracts,op))throw Error('Operação desconhecida.');keys(data,contracts[op]);if(!user?.active)throw Error('Solicitante desconectado.');
 if(!user.isGM&&!['noteSave','theoryCreate','theoryDelete'].includes(op))throw Error('Operação exclusiva do Mestre.');
 const s=copy(state);if(s.schema!==1||!Array.isArray(s.cases)||!s.receipts)throw Error('Banco de investigação inválido.');
 const c=data.caseId?s.cases.find(c=>c.id===data.caseId):null;
 if(op!=='caseSave'&&!c)throw Error('Investigação não encontrada.');if(!user.isGM&&(!c||!canSee(c.audience,user)))throw Error('Investigação não disponível.');
 const get=(rows,id)=>{const r=rows.find(x=>x.id===id);if(!r)throw Error('Registro não encontrado.');return r;};
 const bump=()=>{if(c)c.revision++;};
 if(op==='caseSave'){
  const old=data.id?get(s.cases,data.id):null;if(old)checkRevision(old,data.revision);if(!old&&s.cases.length>=50)throw Error('Limite de cinquenta investigações.');
  if(!has(STATES,data.status))throw Error('Estado inválido.');
  const row={name:text(data.name,120,true),intro:text(data.intro??'',12000),private:text(data.private??'',16000),status:data.status,audience:audience(data.audience,env.users)};
  if(old)Object.assign(old,row,{revision:old.revision+1});else s.cases.push({...row,id:env.uid(),revision:1,clues:[],links:[],notes:{},theories:[]});
 }else if(op==='caseDelete'){checkRevision(c,data.revision);s.cases=s.cases.filter(x=>x.id!==c.id);
 }else if(op==='clueSave'){
  const old=data.id?get(c.clues,data.id):null;if(old)checkRevision(old,data.revision);if(!old&&c.clues.length>=200)throw Error('Limite de duzentas pistas por investigação.');
  if(!has(TYPES,data.type)||!has(ANALYSIS,data.analysis))throw Error('Tipo ou análise inválidos.');
  const tags=Array.isArray(data.tags)?data.tags.map(x=>text(x,40,true)):[];if(tags.length>10)throw Error('Use até dez etiquetas.');
  const row={type:data.type,name:text(data.name,120,true),text:text(data.text??'',16000),private:text(data.private??'',16000),img:asset(data.img),tags:[...new Set(tags)],analysis:data.analysis,audience:audience(data.audience,env.users),sourceUuid:text(data.sourceUuid??'',300)};
  if(row.sourceUuid&&!/^(Actor|Item|JournalEntry|Scene|RollTable|Compendium)\.[A-Za-z0-9._-]+$/.test(row.sourceUuid))throw Error('Referência de origem inválida.');
  if(old)Object.assign(old,row,{revision:old.revision+1});else {const n=c.clues.length;c.clues.push({...row,id:env.uid(),revision:1,position:{x:50+(n%8)*260,y:50+Math.floor(n/8)*200}});}bump();
 }else if(op==='clueDelete'){
  const p=get(c.clues,data.id);checkRevision(p,data.revision);c.clues=c.clues.filter(x=>x.id!==p.id);c.links=c.links.filter(l=>l.from!==p.id&&l.to!==p.id);c.theories=c.theories.filter(t=>t.from!==p.id&&t.to!==p.id);bump();
 }else if(op==='move'){const p=get(c.clues,data.id);checkRevision(p,data.revision);p.position=position(data.position);p.revision++;bump();
 }else if(op==='linkSave'){
  const old=data.id?get(c.links,data.id):null;if(old)checkRevision(old,data.revision);if(!old&&c.links.length>=500)throw Error('Limite de quinhentas conexões.');get(c.clues,data.from);get(c.clues,data.to);if(data.from===data.to)throw Error('Conecte duas pistas diferentes.');if(!['relacao','hipotese'].includes(data.kind))throw Error('Tipo de conexão inválido.');
  const row={from:data.from,to:data.to,label:text(data.label,160,true),private:text(data.private??'',8000),kind:data.kind,audience:audience(data.audience,env.users)};
  if(old)Object.assign(old,row,{revision:old.revision+1});else c.links.push({...row,id:env.uid(),revision:1});bump();
 }else if(op==='linkDelete'){const l=get(c.links,data.id);checkRevision(l,data.revision);c.links=c.links.filter(x=>x.id!==l.id);bump();
 }else if(op==='share'){
  const row=data.kind==='case'?c:data.kind==='clue'?get(c.clues,data.id):data.kind==='link'?get(c.links,data.id):null;if(!row)throw Error('Visibilidade inválida.');checkRevision(row,data.revision);row.audience=audience(data.audience,env.users);row.revision++;if(row!==c)bump();
 }else if(op==='noteSave'){
  const old=c.notes[user.id]??{text:'',revision:0};checkRevision(old,data.revision);c.notes[user.id]={text:text(data.text,12000),revision:old.revision+1};
 }else if(op==='theoryCreate'){
  if(!env.allowTheories&&!user.isGM)throw Error('Propostas de jogadores estão desativadas.');if(c.theories.length>=200)throw Error('Limite de duzentas propostas por investigação.');
  const view=project(s,user).cases.find(x=>x.id===c.id),ids=new Set(view.clues.map(p=>p.id));if(!ids.has(data.from)||!ids.has(data.to)||data.from===data.to)throw Error('Escolha duas pistas disponíveis para você.');
  c.theories.push({id:env.uid(),author:user.id,from:data.from,to:data.to,label:text(data.label,160,true),text:text(data.text??'',8000),status:'pendente',feedback:'',created:env.time});
 }else if(op==='theoryDelete'){
  const t=get(c.theories,data.id);if(!user.isGM&&t.author!==user.id)throw Error('A proposta pertence a outro jogador.');if(!user.isGM&&t.status!=='pendente')throw Error('A proposta já foi resolvida.');c.theories=c.theories.filter(x=>x.id!==t.id);
 }else if(op==='theoryResolve'){
  const t=get(c.theories,data.id);if(t.status!=='pendente')throw Error('Proposta já resolvida.');if(!['aceitar','recusar'].includes(data.decision))throw Error('Decisão inválida.');
  t.feedback=text(data.feedback??'',4000);t.status=data.decision==='aceitar'?'aceita':'recusada';
  if(data.decision==='aceitar'){if(c.links.length>=500)throw Error('Limite de conexões atingido.');get(c.clues,t.from);get(c.clues,t.to);if(!['relacao','hipotese'].includes(data.kind))throw Error('Tipo de conexão inválido.');c.links.push({id:env.uid(),revision:1,from:t.from,to:t.to,label:t.label,private:'',kind:data.kind,audience:audience(data.audience,env.users)});bump();}
 }
 s.revision++;return s;
}
