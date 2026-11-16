import {ID,position} from './model.mjs';
import {command} from './store.mjs';
export function installBoard(app){
 const root=app.element,viewport=root.querySelector('.iv-viewport');if(!viewport)return;
 viewport.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.target.closest('[data-link]'))return;
  const card=e.target.closest('[data-clue]');const c=app.currentCase,p=card?c?.clues.find(p=>p.id===card.dataset.clue):null;
  const start={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};let moved=false,point=p?app.positions.get(p.id):null;
  const origin=point?{...point}:null;const target=card??viewport;target.setPointerCapture?.(e.pointerId);app.dragging=true;
  const move=ev=>{const dx=ev.clientX-start.x,dy=ev.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)<5&&!moved)return;moved=true;ev.preventDefault();
   if(card){point={x:Math.max(0,Math.min(6000,origin.x+dx/app.zoom)),y:Math.max(0,Math.min(6000,origin.y+dy/app.zoom))};card.style.left=point.x+'px';card.style.top=point.y+'px';app.positions.set(p.id,point);drawMovingEdges(root,app.positions);}
   else{viewport.scrollLeft=start.left-dx;viewport.scrollTop=start.top-dy;}
  };
  const end=async ev=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',cancel);target.releasePointerCapture?.(e.pointerId);app.dragging=false;if(!moved)return;app.ignoreClickUntil=Date.now()+150;
   if(!card)return;
   try{point=position(point);if(game.user.isGM)await command('move',{caseId:c.id,id:p.id,revision:p.revision,position:point});else{const layouts=structuredClone(game.settings.get(ID,'layouts')??{});layouts[c.id]??={};layouts[c.id][p.id]=point;await game.settings.set(ID,'layouts',layouts);}}
   catch(error){ui.notifications.warn(error.message);}finally{await app.render(false);}
  };
  const cancel=()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',cancel);app.dragging=false;void app.render(false);};
  target.addEventListener('pointermove',move);target.addEventListener('pointerup',end);target.addEventListener('pointercancel',cancel);
 });
}
function drawMovingEdges(root,positions){for(const g of root.querySelectorAll('g[data-from][data-to]')){const a=positions.get(g.dataset.from),b=positions.get(g.dataset.to);if(!a||!b)continue;const line=g.querySelector('line'),text=g.querySelector('text');line.setAttribute('x1',a.x+115);line.setAttribute('y1',a.y+80);line.setAttribute('x2',b.x+115);line.setAttribute('y2',b.y+80);text.setAttribute('x',(a.x+b.x)/2+115);text.setAttribute('y',(a.y+b.y)/2+74);}}
