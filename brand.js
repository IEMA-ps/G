// Decorative category symbols only. No catalog, role or transaction changes.
(()=>{
 const decorate=()=>document.querySelectorAll('.cat-chip .em:not([data-drawn])').forEach(e=>{e.dataset.drawn='1';const name=e.nextElementSibling?.textContent||'';const choices=[[/سوبر|بقال/,'basket-shopping'],[/خضار|فاكهة/,'carrot'],[/منظف/,'spray-can-sparkles'],[/مكتبي/,'pen-ruler'],[/مطاعم|مأكولات/,'utensils'],[/منزل/,'house'],[/ملابس/,'shirt'],[/إلكترون/,'plug'],[/الكل/,'grip']];const icon=choices.find(([r])=>r.test(name))?.[1]||'bag-shopping';const i=document.createElement('i');i.className='fa-solid fa-'+icon;i.setAttribute('aria-hidden','true');e.replaceChildren(i);});

 decorate();const root=document.querySelector('#mainContent');if(root)new MutationObserver(decorate).observe(root,{childList:true,subtree:true});
})();
