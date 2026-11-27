// Decorative category symbols only. No catalog, role or transaction changes.
(()=>{
 const decorate=()=>document.querySelectorAll('.cat-chip .em:not([data-drawn])').forEach(e=>{e.dataset.drawn='1';const name=e.nextElementSibling?.textContent||'';const choices=[[/سوبر|بقال/,'basket-shopping'],[/خضار|فاكهة/,'carrot'],[/منظف/,'spray-can-sparkles'],[/مكتبي/,'pen-ruler'],[/مطاعم|مأكولات/,'utensils'],[/منزل/,'house'],[/ملابس/,'shirt'],[/إلكترون/,'plug'],[/الكل/,'grip']];const icon=choices.find(([r])=>r.test(name))?.[1]||'bag-shopping';const i=document.createElement('i');i.className='fa-solid fa-'+icon;i.setAttribute('aria-hidden','true');e.replaceChildren(i);});

 decorate();const root=document.querySelector('#mainContent');if(root)new MutationObserver(decorate).observe(root,{childList:true,subtree:true});
})();

/* زر إظهار/إخفاء كلمة المرور لكل حقل كلمة مرور (تسجيل الدخول، حساب جديد، تغيير كلمة المرور). */
(()=>{
  const decorate=()=>document.querySelectorAll('input[type="password"]:not([data-pw-eye])').forEach(inp=>{
    inp.setAttribute('data-pw-eye','1');
    const wrap=document.createElement('div');wrap.className='pw-wrap';
    inp.parentNode.insertBefore(wrap,inp);wrap.appendChild(inp);
    const b=document.createElement('button');b.type='button';b.className='pw-eye';
    const set=show=>{inp.type=show?'text':'password';b.setAttribute('aria-pressed',show?'true':'false');b.setAttribute('aria-label',show?'إخفاء كلمة المرور':'إظهار كلمة المرور');b.innerHTML='<i class="fa-solid '+(show?'fa-eye-slash':'fa-eye')+'" aria-hidden="true"></i>';};
    set(false);
    b.addEventListener('click',()=>{set(inp.type==='password');inp.focus();});
    wrap.appendChild(b);
  });
  const start=()=>{decorate();new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});};
  if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
})();
