// Review-only visual directions. No account, route, catalog or transaction behavior changes.
(()=>{
 const direction=new URLSearchParams(location.search).get('design');
 if(!['a','b'].includes(direction))return;
 document.documentElement.dataset.design=direction;
 const css=document.createElement('link');css.rel='stylesheet';css.href='/designs/'+direction+'/theme.css';document.head.append(css);
 const favicon=document.querySelector('link[rel="icon"][type="image/svg+xml"]');if(favicon)favicon.href='/designs/'+direction+'/logo.svg';
 const apple=document.querySelector('link[rel="apple-touch-icon"]');if(apple)apple.href='/designs/'+direction+'/apple-touch-icon.png';
 const manifest=document.querySelector('link[rel="manifest"]');if(manifest)manifest.href='/designs/'+direction+'/manifest.webmanifest';
 document.querySelector('meta[name="theme-color"]').content=direction==='a'?'#FFF8EE':'#172B50';
 document.addEventListener('DOMContentLoaded',()=>{const logo=document.querySelector('.auth-hero .logo img');if(logo)logo.src='/designs/'+direction+'/logo.svg';
 const decorate=()=>document.querySelectorAll('.cat-chip .em:not([data-drawn])').forEach(e=>{e.dataset.drawn='1';const name=e.nextElementSibling?.textContent||'';const choices=[[/سوبر|بقال/,'basket-shopping'],[/خضار|فاكهة/,'carrot'],[/منظف/,'spray-can-sparkles'],[/مكتبي/,'pen-ruler'],[/مطاعم|مأكولات/,'utensils'],[/منزل/,'house'],[/ملابس/,'shirt'],[/إلكترون/,'plug'],[/الكل/,'grip']];const icon=choices.find(([r])=>r.test(name))?.[1]||'bag-shopping';const i=document.createElement('i');i.className='fa-solid fa-'+icon;i.setAttribute('aria-hidden','true');e.replaceChildren(i);});
 decorate();new MutationObserver(decorate).observe(document.querySelector('#mainContent'),{childList:true,subtree:true});
 });
})();
