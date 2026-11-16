import {ID,copy} from './model.mjs';
import {all,activeGM,view,command,processMessage,boot,database} from './store.mjs';
import {OpenMenu,open,refresh,safe} from './ui.mjs';
import {bindFilePicker} from './forms.mjs';
Hooks.once('init',()=>{
 if(game.system.id!=='sangue-escuro')return;
 game.settings.register(ID,'database',{scope:'world',config:false,type:String,default:''});
 game.settings.register(ID,'views',{scope:'world',config:false,type:Object,default:{},onChange:()=>safe(refresh)()});
 game.settings.register(ID,'layouts',{scope:'client',config:false,type:Object,default:{}});
 game.settings.register(ID,'allowTheories',{name:'Permitir propostas de conexões dos jogadores',hint:'Propostas usam apenas pistas visíveis ao autor e aguardam conferência do Mestre. Anotações pessoais continuam disponíveis.',scope:'world',config:true,type:Boolean,default:true,onChange:()=>safe(refresh)()});
 game.settings.register(ID,'showSheet',{name:'Mostrar acesso às investigações na ficha',hint:'Acrescenta uma aba opcional. O painel independente permanece disponível nas configurações e nos controles de cena.',scope:'world',config:true,type:Boolean,default:false,requiresReload:true});
 game.settings.registerMenu(ID,'panel',{name:'Pistas e Investigações',label:'Abrir investigações',icon:'fas fa-magnifying-glass',type:OpenMenu,restricted:false});
 game.modules.get(ID).api=Object.freeze({versao:1,open,getCases:()=>copy(view().cases),submit:command});
});
Hooks.once('sangueEscuro.api',api=>{
 api.registrarPagina({id:'investigacoes',nome:'Investigações',ordem:270,template:`modules/${ID}/templates/ficha.hbs`,visivel:()=>game.settings.get(ID,'showSheet'),contexto:a=>({podeRolar:a?.type==='character'&&a.isOwner}),acoes:{abrir:()=>open(),rolar:({ator})=>{if(!ator?.isOwner||ator.type!=='character')throw Error('Selecione seu personagem.');return ator.rolarPericia('investigacao');}}});
});
Hooks.on('getSceneControlButtons',config=>{if(game.system.id!=='sangue-escuro')return;const groups=Array.isArray(config)?config:Object.values(config??{}),g=groups.find(x=>['tokens','token'].includes(x.name))??groups[0];if(!g?.tools)return;const t={name:'sangueEscuroInvestigacoes',title:'Pistas e Investigações',icon:'fas fa-magnifying-glass',button:true,visible:true,onChange:()=>safe(open)()};if(Array.isArray(g.tools)){if(!g.tools.some(x=>x.name===t.name))g.tools.push(t);}else g.tools[t.name]={...t,order:Object.keys(g.tools).length};});
Hooks.once('ready',async()=>{
 if(game.system.id!=='sangue-escuro')return;
 Hooks.on('createChatMessage',(m,o,u)=>safe(()=>processMessage(m,o,u))());
 Hooks.on('renderChatMessageHTML',(m,html)=>{if(!m.flags?.[ID]?.request)return;const root=html?.querySelector?html:html?.[0];root?.classList?.add('iv-chat-request');});
 Hooks.on('renderDialogV2',(app,html)=>bindFilePicker(html?.querySelector?html:html?.[0]));
 Hooks.on('investigacoes.refresh',()=>safe(refresh)());
 for(const name of ['updateUser','createUser','deleteUser'])Hooks.on(name,()=>safe(async()=>{if(activeGM())await boot();await refresh();})());
 for(const name of ['updateJournalEntryPage','createJournalEntry','updateJournalEntry','deleteJournalEntry'])Hooks.on(name,doc=>{const d=doc.documentName==='JournalEntryPage'?doc.parent:doc;if(d?.id===database()?.id||d?.flags?.[ID]?.viewFor===game.user.id)safe(refresh)();});
 await safe(boot)();
});
