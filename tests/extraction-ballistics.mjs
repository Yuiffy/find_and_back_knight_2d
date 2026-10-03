import fs from 'node:fs';
import assert from 'node:assert/strict';
import { launchExtractionBrowser } from './extraction-browser.mjs';
import { freshProfile, SAVE_KEY, WEAPONS } from '../src/extraction/model.ts';

const out = '.tmp/test-artifacts/extraction-ballistics';
fs.mkdirSync(out, { recursive: true });
const browser = await launchExtractionBrowser(), report = [];
try {
  for (const [weapon, reducedMotion, suppressed] of [['kestrel',false,false],['shrike',false,false],['heron',true,false],['kestrel',true,true]]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
    page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
    const state = () => page.evaluate(()=>JSON.parse(window.render_game_to_text()));
    const tick = async ms => { await page.evaluate(ms=>window.advanceTime(ms),ms); await page.waitForTimeout(60); return state(); };
    const shots = [];
    await page.goto('http://127.0.0.1:4175/knight/');
    await page.waitForFunction(()=>window.render_game_to_text?.().includes('"phase":"base"'));
    const profile=freshProfile(); profile.guns[weapon]=1; profile.settings.reducedMotion=reducedMotion; profile.suppressors=suppressed?1:0;
    await page.evaluate(({key,profile})=>localStorage.setItem(key,JSON.stringify(profile)),{key:SAVE_KEY,profile}); await page.reload();
    await page.getByRole('button',{name:'准备部署'}).click();
    await page.locator('.ex-weapon').filter({hasText:WEAPONS[weapon].name}).click();
    if(suppressed) await page.getByLabel('消音器').check();
    await page.locator('#ex-deploy').click(); await tick(0);
    // Move through an open lane until all three weapons are in range.
    await page.keyboard.down('KeyW'); await tick(1550); await page.keyboard.up('KeyW'); await tick(0);
    const base=await state(), enemy=base.enemies.find(e=>e.id===0), point=base.screen.enemies.find(e=>e.id===0);
    await page.mouse.move(point.x,point.y); await page.waitForTimeout(70);
    await page.mouse.down({button:'right'}); await page.mouse.down(); await tick(1); await page.mouse.up();
    const fired=await state();
    assert.equal(fired.ballistics.shots,1); assert.equal(fired.player.mag,WEAPONS[weapon].mag-1);
    assert.equal(fired.enemies.find(e=>e.id===0).hp,enemy.hp,'No immediate ray damage');
    assert.equal(fired.ballistics.bullets.filter(b=>!b.enemy).length,1); assert(fired.ballistics.recoil>0); assert.equal(fired.ballistics.casings,1);
    await page.screenshot({path:`${out}/${weapon}-${suppressed?'suppressed':'normal'}-muzzle.png`});
    const flying=await tick(70), b=flying.ballistics.bullets.find(b=>!b.enemy);
    assert(b); assert(b.travelled>3); assert(b.travelled<8);
    assert.equal(flying.enemies.find(e=>e.id===0).hp,enemy.hp);
    await page.screenshot({path:`${out}/${weapon}-${suppressed?'suppressed':'normal'}-flight.png`});
    const screen=flying.screen.bullets.find(p=>p.id===b.id);
    await page.screenshot({path:`${out}/${weapon}-${suppressed?'suppressed':'normal'}-flight-detail.png`,clip:{x:Math.max(0,screen.x-95),y:Math.max(0,screen.y-90),width:190,height:180}});
    // A visible pause must freeze the exact in-flight bullet, including recoil.
    await page.keyboard.press('Escape'); const frozen=(await state()).ballistics; await tick(500);
    assert.deepEqual((await state()).ballistics,frozen);
    await page.getByRole('button',{name:'继续行动'}).click();
    const landed=await tick(145);
    assert(landed.enemies.find(e=>e.id===0).hp<enemy.hp,'Only a later flight step hits');
    assert(landed.ballistics.hit); assert(landed.ballistics.impacts.length);
    await page.screenshot({path:`${out}/${weapon}-${suppressed?'suppressed':'normal'}-hit.png`});
    for(let n=0;n<12&&(await state()).kills===0;n++){
      const s=await state(), target=s.screen.enemies.find(e=>e.id===0); if(!target) break;
      await page.mouse.move(target.x,target.y); await page.waitForTimeout(30);
      await page.mouse.down(); await tick(1); await page.mouse.up(); await tick(WEAPONS[weapon].interval*1000+240);
    }
    await page.mouse.up({button:'right'});
    const killed=await state(); assert(killed.kills>=1); assert(killed.crates.some(c=>c.id==='enemy-0'));
    assert.equal(killed.audio.state,'running'); assert(killed.audio.played>=4); assert.deepEqual(errors,[]);
    shots.push({fired:fired.ballistics,flying:flying.ballistics,landed:landed.ballistics});
    report.push({weapon,reducedMotion,suppressed,delayed:true,travelled:b.travelled,kill:killed.kills,audio:killed.audio,shots,errors});
    await page.close();
  }
  fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));
  console.log('Real mouse ballistics, flight delay, three weapons, impact, pause, kill and audio PASS',JSON.stringify(report.map(({shots,...r})=>r)));
} finally { await browser.close(); }
