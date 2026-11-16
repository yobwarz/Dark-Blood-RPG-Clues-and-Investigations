import {ID,TYPES,STATES,ANALYSIS,copy,position} from './model.mjs';
import {all,view,command,publish,queue,activeGM,needsSync} from './store.mjs';
import {caseForm,clueForm,linkForm,shareForm,noteForm,resolveForm,confirm,audienceName} from './forms.mjs';
import {installBoard} from './board.mjs';
const {ApplicationV2,HandlebarsApplicationMixin}=foundry.applications.api;
const windows=new Set();
export const safe=fn=>async(...args)=>{try{return await fn(...args);}catch(e){console.error(ID,e);ui.notifications.warn(e.message);}};
export class InvestigationPanel extends HandlebarsApplicationMixin(ApplicationV2){
 constructor(options={}){super(options);windows.add(this);this.caseId=options.caseId??null;this.selectedClue=options.clueId??null;this.selectedLink=null;this.mode='board';this.query='';this.type='';this.zoom=1;this.scroll={left:0,top:0};this.positions=new Map();}
 static DEFAULT_OPTIONS={id:'se-investigacoes',classes:['sangue-escuro','iv-window'],window:{title:'Pistas e Investigações',resizable:true},position:{width:1220,height:820},actions:{investigacao:InvestigationPanel.action}};
 static PARTS={main:{template:`modules/${ID}/templates/panel.hbs`,scrollable:['.iv-cases','.iv-inspector','.iv-list']}};
 async _prepareContext(){
  const old=this.element?.querySelector?.('.iv-viewport');if(old&&!this.resetScroll)this.scroll={left:old.scrollLeft,top:old.scrollTop};if(this.resetScroll){this.scroll={left:0,top:0};this.resetScroll=false;}
  const data=view(),gm=game.user.isGM;if(!data.cases.some(c=>c.id===this.caseId)){this.caseId=data.cases.find(c=>c.status==='aberto')?.id??data.cases[0]?.id;this.selectedClue=null;this.selectedLink=null;this.scroll={left:0,top:0};}
  const c=data.cases.find(c=>c.id===this.caseId);this.currentCase=c;
  const personal=game.settings.get(ID,'layouts')?.[c?.id]??{};this.positions=new Map();for(const p of c?.clues??[]){let point=p.position;if(!gm&&personal[p.id])try{point=position(personal[p.id]);}catch{}this.positions.set(p.id,point);}
  const query=this.query.toLocaleLowerCase('pt-BR'),filtered=(c?.clues??[]).filter(p=>(!this.type||p.type===this.type)&&(!query||[p.name,p.text,...p.tags].join(' ').toLocaleLowerCase('pt-BR').includes(query))),ids=new Set(filtered.map(p=>p.id));
  const cards=filtered.map(p=>({...p,...this.positions.get(p.id),image:p.img||`modules/${ID}/assets/icones/${p.type}.svg`,typeName:TYPES[p.type],analysisName:ANALYSIS[p.analysis],selected:p.id===this.selectedClue,hidden:gm&&!p.audience?.length,audienceName:gm?audienceName(p.audience):''}));
  const links=(c?.links??[]).filter(l=>ids.has(l.from)&&ids.has(l.to)).map(l=>{const a=this.positions.get(l.from),b=this.positions.get(l.to);return {...l,x1:a.x+115,y1:a.y+80,x2:b.x+115,y2:b.y+80,mx:(a.x+b.x)/2+115,my:(a.y+b.y)/2+74,hypothesis:l.kind==='hipotese',selected:l.id===this.selectedLink};});
  const clue=c?.clues.find(p=>p.id===this.selectedClue),link=c?.links.find(l=>l.id===this.selectedLink);if(!clue)this.selectedClue=null;if(!link)this.selectedLink=null;
  const selected=clue?{...clue,typeName:TYPES[clue.type],analysisName:ANALYSIS[clue.analysis],image:clue.img||`modules/${ID}/assets/icones/${clue.type}.svg`,audienceName:gm?audienceName(clue.audience):'',connections:(c.links??[]).filter(l=>l.from===clue.id||l.to===clue.id).map(l=>({...l,other:c.clues.find(p=>p.id===(l.from===clue.id?l.to:l.from))?.name??'',kindName:l.kind==='hipotese'?'Hipótese':'Relação'}))}:null;
  const selectedLink=link?{...link,fromName:c.clues.find(p=>p.id===link.from)?.name,toName:c.clues.find(p=>p.id===link.to)?.name,audienceName:gm?audienceName(link.audience):'',kindName:link.kind==='hipotese'?'Hipótese':'Relação estabelecida'}:null;
  const theories=(c?.theories??[]).map(t=>({...t,authorName:gm?game.users.get(t.author)?.name??'Jogador':null,fromName:c.clues.find(p=>p.id===t.from)?.name??'Pista removida',toName:c.clues.find(p=>p.id===t.to)?.name??'Pista removida',pending:t.status==='pendente'}));
  const playerNotes=gm?Object.entries(c?.notes??{}).filter(([id,n])=>id!==game.user.id&&n.text).map(([id,n])=>({name:game.users.get(id)?.name??'Participante',text:n.text})):[];
  const width=Math.max(1500,...cards.map(p=>p.x+300)),height=Math.max(950,...cards.map(p=>p.y+230));
  return {gm,playerNotes,hasPlayerNotes:playerNotes.length>0,activeGM:activeGM(),pending:gm&&needsSync(),connected:!!game.users.activeGM,cases:data.cases.map(x=>({id:x.id,name:x.name,statusName:STATES[x.status],pending:gm?(x.theories??[]).filter(t=>t.status==='pendente').length:0,selected:x.id===this.caseId})),hasCases:data.cases.length>0,current:c?{...c,statusName:STATES[c.status],audienceName:gm?audienceName(c.audience):'',clueCount:c.clues.length,linkCount:c.links.length,hidden:gm&&!c.audience.length}:null,cards,links,hasCards:cards.length>0,hasClues:!!c?.clues.length,boardMode:this.mode==='board',listMode:this.mode==='list',query:this.query,types:Object.entries(TYPES).map(([id,name])=>({id,name,selected:this.type===id})),selected,selectedLink,hasSelection:!!(selected||selectedLink),theories,hasTheories:theories.length>0,allowTheories:gm||game.settings.get(ID,'allowTheories'),canConnect:(c?.clues.length??0)>1,zoom:Math.round(this.zoom*100),scale:this.zoom,width,height,scaledWidth:Math.ceil(width*this.zoom),scaledHeight:Math.ceil(height*this.zoom),note:gm?c?.notes?.[game.user.id]?.text??'':c?.note?.text??''};
 }
 _onRender(context,options){super._onRender?.(context,options);const root=this.element,v=root.querySelector('.iv-viewport');if(v){v.scrollLeft=this.scroll.left;v.scrollTop=this.scroll.top;}installBoard(this);
  root.querySelector('[data-iv-search]')?.addEventListener('input',e=>{const cursor=e.target.selectionStart;this.query=e.target.value;clearTimeout(this.searchTimer);this.searchTimer=setTimeout(async()=>{await this.render(false);const input=this.element?.querySelector('[data-iv-search]');input?.focus();input?.setSelectionRange(cursor,cursor);},200);});
  root.querySelector('[data-iv-type]')?.addEventListener('change',e=>{this.type=e.target.value;this.render(false);});
  root.querySelector('.iv-workspace')?.addEventListener('dragover',e=>{if(game.user.isGM)e.preventDefault();});
  root.querySelector('.iv-workspace')?.addEventListener('drop',safe(async e=>{if(!game.user.isGM||!this.currentCase)return;e.preventDefault();const raw=e.dataTransfer.getData('text/plain');if(!raw)return;let d;try{d=JSON.parse(raw);}catch{return;}if(!d.uuid||typeof d.uuid!=='string')return;const doc=await fromUuid(d.uuid);if(!doc||!['Actor','Item','JournalEntry','JournalEntryPage','Scene','RollTable'].includes(doc.documentName))return;const seed={name:doc.name,img:doc.img??'',sourceUuid:doc.uuid,type:doc.documentName==='Actor'?'pessoa':'documento'};await clueForm(this.currentCase,null,seed);}));
 }
 static async action(e,b){if(Date.now()<(this.ignoreClickUntil??0))return;b.disabled=true;try{await this.perform(b.dataset.op,b.dataset);}catch(error){console.error(ID,error);ui.notifications.warn(error.message);}finally{if(b.isConnected)b.disabled=false;}}
 async perform(op,d={}){
  const c=this.currentCase,clue=c?.clues.find(x=>x.id===(d.id??this.selectedClue)),link=c?.links.find(x=>x.id===(d.id??this.selectedLink));
  if(op==='case'){this.caseId=d.id;this.selectedClue=null;this.selectedLink=null;this.scroll={left:0,top:0};this.resetScroll=true;this.query='';this.type='';this.zoom=1;}
  else if(op==='newCase')await caseForm();
  else if(op==='editCase')await caseForm(c);
  else if(op==='deleteCase'){if(await confirm('Excluir investigação','Excluir este caso, suas pistas, conexões, propostas e anotações? Não apaga documentos de origem.'))await command('caseDelete',{caseId:c.id,revision:c.revision});}
  else if(op==='shareCase')await shareForm(c,'case',c);
  else if(op==='newClue')await clueForm(c);
  else if(op==='editClue')await clueForm(c,clue);
  else if(op==='shareClue')await shareForm(c,'clue',clue);
  else if(op==='deleteClue'){if(await confirm('Excluir pista','Excluir esta pista e suas conexões/propostas? O documento de origem permanece intacto.')){await command('clueDelete',{caseId:c.id,id:clue.id,revision:clue.revision});this.selectedClue=null;}}
  else if(op==='selectClue'){this.selectedClue=d.id;this.selectedLink=null;}
  else if(op==='selectLink'){this.selectedLink=d.id;this.selectedClue=null;}
  else if(op==='closeInspector'){this.selectedClue=null;this.selectedLink=null;}
  else if(op==='newLink')await linkForm(c,null,!game.user.isGM);
  else if(op==='editLink')await linkForm(c,link);
  else if(op==='shareLink')await shareForm(c,'link',link);
  else if(op==='deleteLink'){if(await confirm('Excluir conexão','Remover somente esta conexão?')){await command('linkDelete',{caseId:c.id,id:link.id,revision:link.revision});this.selectedLink=null;}}
  else if(op==='note')await noteForm(c);
  else if(op==='resolve')await resolveForm(c,c.theories.find(t=>t.id===d.id));
  else if(op==='deleteTheory'){if(await confirm('Retirar proposta','Remover o registro desta proposta? Uma conexão já aceita permanece no quadro.'))await command('theoryDelete',{caseId:c.id,id:d.id});}
  else if(op==='sync'){if(activeGM())await queue(publish);else ui.notifications.info('Solicite sincronização ao Mestre conectado.');}
  else if(op==='list')this.mode='list';
  else if(op==='board')this.mode='board';
  else if(op==='zoomIn')this.zoom=Math.min(1.6,this.zoom+.15);
  else if(op==='zoomOut')this.zoom=Math.max(.35,this.zoom-.15);
  else if(op==='resetZoom'){this.zoom=1;this.scroll={left:0,top:0};this.resetScroll=true;}
  else if(op==='fit'){const v=this.element.querySelector('.iv-viewport');if(v){const xs=[...this.positions.values()];this.zoom=Math.max(.35,Math.min(1,(v.clientWidth-20)/Math.max(800,...xs.map(p=>p.x+280)),(v.clientHeight-20)/Math.max(500,...xs.map(p=>p.y+220))));this.scroll={left:0,top:0};this.resetScroll=true;}}
  else if(op==='resetLayout'){const layouts=copy(game.settings.get(ID,'layouts')??{});delete layouts[c.id];await game.settings.set(ID,'layouts',layouts);}
  else if(op==='source'){if(!game.user.isGM)throw Error('Origem reservada ao Mestre.');const doc=await fromUuid(clue.sourceUuid);if(doc?.sheet)await doc.sheet.render(true);else ui.notifications.warn('Documento de origem indisponível.');}
  else throw Error('Ação não encontrada.');
  await this.render(false);
 }
 async close(options){clearTimeout(this.searchTimer);windows.delete(this);return super.close(options);}
}
let panel;export async function open(options={}){if(!panel||!panel.rendered)panel=new InvestigationPanel(options);if(options.caseId)panel.caseId=options.caseId;if(options.clueId)panel.selectedClue=options.clueId;return panel.render(true);}
export async function refresh(){for(const w of windows)if(w.rendered&&!w.dragging)await w.render(false);}

export class OpenMenu extends ApplicationV2 {async render(){await open();return this;}}
