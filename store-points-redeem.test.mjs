import * as SP from './store-points.js';
import * as OT from './order-tx.js';
let n=0;const eq=(a,b)=>{n++;if(JSON.stringify(a)!==JSON.stringify(b))throw new Error('expected '+JSON.stringify(b)+' got '+JSON.stringify(a));};
const cfg=SP.config({on:true,egpPerPoint:10,pointValue:0.5});
eq(SP.redeem(100,cfg,30),{points:60,discount:30});        // capped by goods
eq(SP.redeem(10,cfg,30),{points:10,discount:5});          // capped by balance
eq(SP.redeem(10.9,cfg,30),{points:10,discount:5});
eq(SP.redeem(10,SP.config({on:false,egpPerPoint:10,pointValue:1}),30),{points:0,discount:0});
eq(SP.redeem(-5,cfg,30),{points:0,discount:0});
eq(SP.redeem(10,cfg,0),{points:0,discount:0});
eq(SP.redeem(10,cfg,0.9),{points:1,discount:0.5});
const raw={on:true,egpPerPoint:10,pointValue:1};
const p=SP.planCart({use:{a:true,b:true,c:false},balances:{a:20,b:5,c:9},goodsBy:{a:50,b:3,c:40},cfgBy:{a:raw,b:raw,c:raw}});
eq(p,{byStore:{a:{points:20,discount:20},b:{points:3,discount:3}},total:23});
eq(SP.planCart({use:{a:true},balances:{a:5},goodsBy:{a:50},cfgBy:{}}),{byStore:{},total:0}); // store without points
// cancel gives store points back once, for that sub order only
const sub={id:'S',status:'SENT_TO_MERCHANT',storePointsRedeemed:7,items:[]};
eq(OT.planRestore(sub,[sub],{pointsRedeemed:0}).storePoints,7);
eq(OT.planRestore({...sub,storePointsRestored:true},[sub],{}).storePoints,0);
eq(OT.planRestore({...sub,status:'CANCELLED'},[sub],{}).storePoints,0);
eq(OT.planRestore({id:'S',status:'SENT_TO_MERCHANT',items:[]},[],{}).storePoints,0);
// invite credit goes back to the field it was paid from
eq(OT.planRestore({id:'S',status:'SENT_TO_MERCHANT',items:[]},[{id:'S',status:'SENT_TO_MERCHANT'}],{pointsRedeemed:5,pointsField:'inviteCredit'}).pointsField,'inviteCredit');
eq(OT.planRestore({id:'S',status:'SENT_TO_MERCHANT',items:[]},[{id:'S',status:'SENT_TO_MERCHANT'}],{pointsRedeemed:5}).pointsField,'loyaltyPoints');
console.log(`store-points-redeem: ${n} checks passed`);
