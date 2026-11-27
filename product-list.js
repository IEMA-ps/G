// Text product list: one row per product, no photo needed. Category emoji replaces the image.
const FALLBACK_ICON='🛒';
export function escapeText(s){return s==null?'':String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function productIcon(category){return (category&&category.iconEmoji)||FALLBACK_ICON;}
export function productRow({p,category,qty=0,priceHtml,badge='',wished=false}){
 const out=!p.isActive||p.stock<=0, id=escapeText(p.id), icon=productIcon(category);
 const unit=p.unit?`<span class="pl-unit">${escapeText(p.unit)}</span>`:'';
 const big=!!p.imageUrl&&p.imageSize==='large';
 const lead=big?`<img class="pl-big" src="${escapeText(p.imageUrl)}" alt="" loading="lazy">`:p.imageUrl?`<img class="pl-thumb" src="${escapeText(p.imageUrl)}" alt="" loading="lazy">`:`<span class="pl-icon" aria-hidden="true">${escapeText(icon)}</span>`;
 const act=out?`<span class="pl-out">غير متوفر</span>`
  :qty>0?`<div class="pl-step"><button type="button" aria-label="إنقاص" onclick="setCartQty('${id}',${qty-1})">−</button><span>${qty}</span><button type="button" aria-label="زيادة" onclick="setCartQty('${id}',${qty+1})">+</button></div>`
  :`<button type="button" class="pl-add" aria-label="أضف ${escapeText(p.title)}" onclick="addToCart('${id}')">+</button>`;
 return `<div class="pl-row${out?' pl-off':''}${big?' pl-large':''}">${lead}<div class="pl-main" onclick="openProduct('${id}')"><div class="pl-title">${escapeText(p.title)}${badge}</div><div class="pl-meta"><span class="pl-price">${priceHtml}</span>${unit}</div></div>${act}</div>`;
}
