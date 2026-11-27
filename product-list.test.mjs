import {test} from 'node:test';import assert from 'node:assert/strict';
import {productRow,productIcon,escapeText} from './product-list.js';
const p={id:'a1',title:'أرز <b>',unit:'كيس 1 كجم',isActive:true,stock:5,imageUrl:''};
test('no photo: category emoji, title, price, + button',()=>{const h=productRow({p,category:{iconEmoji:'🥬'},priceHtml:'<b>30</b>'});assert.match(h,/🥬/);assert.match(h,/addToCart\('a1'\)/);assert.doesNotMatch(h,/<img/);assert.match(h,/&lt;b&gt;/);});
test('fallback icon and optional photo',()=>{assert.equal(productIcon(null),'🛒');assert.match(productRow({p:{...p,imageUrl:'https://x/y.jpg'},priceHtml:'1'}),/<img class="pl-thumb"/);});
test('cart stepper and sold out',()=>{assert.match(productRow({p,qty:2,priceHtml:'1'}),/setCartQty\('a1',3\)/);const o=productRow({p:{...p,stock:0},priceHtml:'1'});assert.match(o,/غير متوفر/);assert.doesNotMatch(o,/addToCart/);});
test('escape',()=>assert.equal(escapeText(`"'<`),'&quot;&#39;&lt;'));
test('large photo only when chosen and a photo exists',()=>{const u='https://x/y.jpg';assert.match(productRow({p:{...p,imageUrl:u,imageSize:'large'},priceHtml:'1'}),/pl-row pl-large[\s\S]*<img class="pl-big"/);assert.match(productRow({p:{...p,imageUrl:u,imageSize:'small'},priceHtml:'1'}),/<img class="pl-thumb"/);assert.doesNotMatch(productRow({p:{...p,imageUrl:'',imageSize:'large'},priceHtml:'1'}),/pl-big|pl-large/);});
