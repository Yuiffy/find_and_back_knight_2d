import fs from 'node:fs';
import assert from 'node:assert/strict';
import { launchExtractionBrowser } from './extraction-browser.mjs';
import { freshProfile, SAVE_KEY, ITEMS } from '../src/extraction/model.ts';

const ids=['dq_pistachio','beef_jerky','sicily_lemon','rtx_3050','rtx_5070ti','cpu_9800x3d','cat_food','cat_litter','swim_pass','gym_pass','sichuan_hotpot','biscuit_note','cpu_12400f','tarnished_camera'];
const out='.tmp/test-artifacts/extraction-life-responsive';fs.mkdirSync(out,{recursive:true});
const browser=await launchExtractionBrowser(),report=[];
try{
  for(const [width,height] of [[2560,1440],[1280,720],[390,844],[320,568],[844,390]]){
    const context=await browser.newContext({viewport:{width,height},hasTouch:width<1000}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
    const tick=async ms=>{await page.evaluate(ms=>window.advanceTime(ms),ms);await page.waitForTimeout(75);};
    const grid=zone=>page.locator(`[data-grid-zone="${zone}"]`),tile=(zone,id)=>grid(zone).locator(`[data-item="${id}"]`).first();
    const act=locator=>width<1000?locator.tap():locator.click();
    await page.goto('http://127.0.0.1:4175/knight/');await page.waitForFunction(()=>window.render_game_to_text?.().includes('"phase":"base"'));
    const profile=freshProfile();profile.packLevel=2;profile.settings.reducedMotion=true;profile.lost={x:-32,z:37,weapon:'kestrel',items:ids};
    await page.evaluate(({key,profile})=>localStorage.setItem(key,JSON.stringify(profile)),{key:SAVE_KEY,profile});await page.reload();
    await act(page.getByRole('button',{name:'准备部署'}));await act(page.locator('#ex-deploy'));await tick(0);
    await page.keyboard.press('KeyE');await tick(0);assert.equal((await state()).search.revealed,ids.length);
    for(const id of ids){
      const svg=tile('crate',id).locator('svg[role="img"]');assert.equal(await svg.count(),1);assert.equal(await svg.getAttribute('aria-label'),`${ITEMS[id].name}图像`);
      assert(await svg.locator('path,rect,circle,ellipse').count()>2,`Empty illustration ${id}`);
      if(width===1280)await tile('crate',id).screenshot({path:`${out}/art-${id}.png`});
    }
    await act(tile('crate','dq_pistachio'));assert.equal(await page.locator('.ex-inventory-details').getAttribute('data-selected-item'),'dq_pistachio');await page.screenshot({path:`${out}/${width}-food.png`});
    await act(tile('crate','rtx_5070ti'));await act(page.getByRole('button',{name:'旋转选中物资'}));
    await act(grid('bag').getByRole('gridcell',{name:'背包空格 1,1',exact:true}));await tick(0);
    let s=await state();assert.deepEqual(s.bag,['rtx_5070ti']);assert.deepEqual(s.bagLayout[0],{x:0,y:0,rotated:true});assert.equal(s.usedCells,6);
    await act(tile('bag','rtx_5070ti'));assert(await page.getByRole('button',{name:'保护RTX 5070 Ti 显卡',exact:true}).isDisabled());
    await page.screenshot({path:`${out}/${width}-hardware.png`});
    await act(tile('crate','cpu_9800x3d'));await act(page.getByRole('button',{name:'收纳',exact:true}));await act(tile('bag','cpu_9800x3d'));
    await act(page.getByRole('button',{name:'保护Ryzen 9800X3D',exact:true}));await tick(0);assert.equal((await state()).secure,'cpu_9800x3d');
    await act(tile('crate','cat_litter'));assert.equal(await page.locator('.ex-inventory-details').getAttribute('data-selected-item'),'cat_litter');await page.screenshot({path:`${out}/${width}-cat.png`});
    assert.equal(await page.getByRole('button',{name:'使用豆腐猫砂',exact:true}).count(),0);
    await act(tile('crate','swim_pass'));assert.equal(await page.locator('.ex-inventory-details').getAttribute('data-selected-item'),'swim_pass');await page.screenshot({path:`${out}/${width}-card.png`});
    const overflow=await page.evaluate(()=>document.querySelector('.ex-modal').scrollWidth>document.querySelector('.ex-modal').clientWidth+1);
    assert(!overflow);assert.deepEqual(errors,[]);
    report.push({width,height,allImages:ids.length,rotation:true,cellPlacement:true,cpuProtected:true,errors});
    await context.close();
  }
  fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
  console.log('Fourteen familiar SVGs, five viewports, actual touch selection/rotation/placement, large GPU and CPU safety PASS',JSON.stringify(report));
}finally{await browser.close();}
