import fs from 'node:fs';
import assert from 'node:assert/strict';
import { launchExtractionBrowser } from './extraction-browser.mjs';
import { freshProfile, SAVE_KEY, ITEMS } from '../src/extraction/model.ts';
import { blocked } from '../src/extraction/map.ts';

const out='.tmp/test-artifacts/extraction-life-loot'; fs.mkdirSync(out,{recursive:true});
const browser=await launchExtractionBrowser(), page=await browser.newPage({viewport:{width:1440,height:900}}), errors=[];
page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const tick=async ms=>{await page.evaluate(ms=>window.advanceTime(ms),ms); await page.waitForTimeout(15); return state();};
const grid=zone=>page.locator(`[data-grid-zone="${zone}"]`), tile=(zone,id)=>grid(zone).locator(`[data-item="${id}"]`).first();
const seen=new Set();
async function fight(){
  for(let n=0;n<60;n++){
    const s=await state(); assert.equal(s.phase,'raid',JSON.stringify(s.player));
    const e=s.enemies.filter(e=>Math.hypot(e.x-s.player.x,e.z-s.player.z)<20&&!blocked(e.x,e.z,s.player.x,s.player.z)&&!blocked(e.x+.35,e.z,s.player.x,s.player.z)&&!blocked(e.x-.35,e.z,s.player.x,s.player.z)).sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];
    if(!e)return;
    const p=s.screen.enemies.find(p=>p.id===e.id); if(p.y<95||p.y>730||p.x<10||p.x>1400)return;
    if(s.player.mag===0){await page.keyboard.press('KeyR');await tick(2450);continue;}
    await page.mouse.move(p.x,p.y);await page.waitForTimeout(25);await page.mouse.down({button:'right'});await page.mouse.down();await tick(20);await page.mouse.up();await page.mouse.up({button:'right'});await tick(660);
  }
  throw new Error('Fight did not finish');
}
async function move(x,z){
  for(let n=0;n<200;n++){
    await fight(); const s=await state(),dx=x-s.player.x,dz=z-s.player.z;
    if(Math.hypot(dx,dz)<.35)return;
    const keys=[];if(Math.abs(dx)>.2)keys.push(dx>0?'KeyD':'KeyA');if(Math.abs(dz)>.2)keys.push(dz>0?'KeyS':'KeyW');
    for(const k of keys)await page.keyboard.down(k);await tick(Math.min(350,Math.hypot(dx,dz)/5.2*1000));for(const k of keys)await page.keyboard.up(k);await tick(1);
  }
  throw new Error(`Blocked waypoint ${x},${z} ${JSON.stringify((await state()).player)}`);
}
async function search(id,wanted){
  await fight();await page.keyboard.press('KeyE');await tick(2900);const s=await state();assert.equal(s.search?.id,id);
  for(const item of s.search.loot){seen.add(item);assert.equal(await tile('crate',item).locator('svg[role="img"]').count(),1);}
  await page.screenshot({path:`${out}/${id}-search.png`});
  for(const item of wanted){await tile('crate',item).click();await page.getByRole('button',{name:'收纳',exact:true}).click();await tick(0);assert((await state()).bag.includes(item));}
  await page.getByRole('button',{name:'整理背包'}).click();await page.getByRole('button',{name:'关闭面板'}).click();await tick(0);
}
try{
  await page.goto('http://127.0.0.1:4175/knight/');await page.waitForFunction(()=>window.render_game_to_text?.().includes('"phase":"base"'));
  const profile=freshProfile();profile.guns.heron=1;profile.packLevel=2;
  await page.evaluate(({key,profile})=>localStorage.setItem(key,JSON.stringify(profile)),{key:SAVE_KEY,profile});await page.reload();
  await page.getByRole('button',{name:'准备部署'}).click();await page.locator('.ex-weapon').filter({hasText:'H-7 苍鹭'}).click();await page.locator('#ex-deploy').click();await tick(0);
  await move(-29,34.5);await search('dock',['beef_jerky','dq_pistachio','sicily_lemon']);
  // Normal sprint input creates a real need for food; no health or raid mutation.
  await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyS');await tick(1000);await page.keyboard.up('KeyS');await page.keyboard.up('ShiftLeft');
  const before=await state();assert(before.player.stamina<100);
  await page.getByRole('button',{name:'打开战术背包'}).click();await tile('bag','dq_pistachio').click();
  await page.getByRole('button',{name:'使用DQ 开心果冰淇淋',exact:true}).click();await tick(0);
  assert(!(await state()).bag.includes('dq_pistachio'));assert((await state()).player.stamina>before.player.stamina);
  await page.screenshot({path:`${out}/food-used.png`});await page.getByRole('button',{name:'关闭面板'}).click();
  await move(-32,35);await move(-40,30);await search('dock2',['cat_food','cat_litter','biscuit_note']);
  await move(-32,30);await move(-32,7);await move(-29,4);await search('freight',['rtx_3050','cpu_12400f']);
  await move(-32,4);await move(-32,-4);await move(-43,-4);await move(-43,-16);await move(-36,-17);
  await search('freight2',['rtx_5070ti','cpu_9800x3d']);
  await page.getByRole('button',{name:'打开战术背包'}).click();await tile('bag','cpu_9800x3d').click();await page.getByRole('button',{name:'保护Ryzen 9800X3D',exact:true}).click();await tick(0);
  assert.equal((await state()).secure,'cpu_9800x3d');await page.getByRole('button',{name:'关闭面板'}).click();
  await move(-43,-16);await move(-43,-4);await move(-32,-4);await move(-32,7);await move(-17,7);await move(-9,7);await move(8,0);await move(25,0);await move(28,2);
  await search('med2',['swim_pass','gym_pass','tarnished_camera']);
  const named=['dq_pistachio','beef_jerky','sicily_lemon','rtx_3050','rtx_5070ti','cpu_9800x3d','cat_food','cat_litter','swim_pass','gym_pass'];for(const id of named)assert(seen.has(id),`Missing natural search ${id}`);
  await move(28,0);await move(8,0);await move(8,25);await move(-9,25);await move(-9,34);await move(-32,34);await move(-32,42);await tick(6500);
  const won=await state();assert.equal(won.phase,'won');for(const id of named.filter(id=>id!=='dq_pistachio'))assert(won.profile.stash.includes(id),`Not returned ${id}`);
  assert.equal(await page.locator('.ex-result-loot svg[role="img"]').count(),won.profile.last.items.length);
  await page.screenshot({path:`${out}/returned.png`});await page.getByRole('button',{name:'返回基地'}).click();await page.getByRole('button',{name:'03 仓库 / 后勤'}).click();
  await tile('stash','rtx_5070ti').click();await page.getByRole('button',{name:'旋转选中物资'}).click();await page.screenshot({path:`${out}/hardware-stash.png`});
  const oldCredits=(await state()).profile.credits;await page.getByRole('button',{name:'出售',exact:true}).click();assert.equal((await state()).profile.credits,oldCredits+ITEMS.rtx_5070ti.value);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'导出存档'}).click();await(await download).saveAs(`${out}/save.json`);
  const saved=(await state()).profile;await page.reload();await page.waitForFunction(()=>window.render_game_to_text?.().includes('"phase":"base"'));assert.deepEqual((await state()).profile,saved);
  assert.deepEqual(errors,[]);fs.writeFileSync(`${out}/report.json`,JSON.stringify({seen:[...seen],foodUsed:true,returned:saved.stash,hardwareSale:true,saved:true,errors},null,2));
  console.log('Natural map searches, all ten requested items, food, protection, extraction, hardware sale and reload PASS',JSON.stringify({seen:[...seen],errors}));
}finally{await browser.close();}
