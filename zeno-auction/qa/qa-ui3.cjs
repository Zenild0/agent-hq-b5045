const L = require('./lib.cjs'); const { chromium, BASE, sleep, t, api, newPage, done } = L;
const errors = [];
const LK = 100_000;
(async () => {
  const b = await chromium.launch();
  const c = await api.create({ name: 'Live QA', drawMode: 'random', defaultBudget: 50 * LK, defaultBasePrice: 2 * LK, increments: [{ from: 0, step: 1 * LK }, { from: 20 * LK, step: 5 * LK }], maxSquad: 2 });
  const { code, adminKey, hostKey } = c;
  for (const [team, name] of [['Red', 'Ann'], ['Blue', 'Bob'], ['Green', 'Gus'], ['Gold', 'Gia']]) await api.cmd(code, adminKey, 'captain.add', { team, name });
  const names = ['Ava', 'Ben', 'Cy', 'Dee', 'Eli', 'Fay', 'Gil', 'Hal', 'Ivy', 'Jon', 'Kai', 'Lia'];
  await api.cmd(code, adminKey, 'players.import', { rows: names.map((n, i) => ({ name: n, role: i % 2 ? 'Bowler' : 'Batter', description: 'about ' + n })) });
  let st = await api.state(code, adminKey);
  const tok = st.captains.map(x => st.secrets.captainTokens[x.id]);
  const S = () => api.state(code, adminKey);

  const live = await newPage(b, 1500, 850, errors, 'live'); const host = await newPage(b, 1500, 1000, errors, 'host');
  const c1 = await newPage(b, 390, 844, errors, 'c1', { isMobile: true, hasTouch: true }); const c2 = await newPage(b, 390, 844, errors, 'c2', { isMobile: true, hasTouch: true });
  await live.goto(`${BASE}/e/${code}/live`); await host.goto(`${BASE}/e/${code}/host?k=${hostKey}`);
  await c1.goto(`${BASE}/e/${code}/captain?k=${tok[0]}`); await c2.goto(`${BASE}/e/${code}/captain?k=${tok[1]}`);
  await host.waitForSelector('text=SPIN THE WHEEL');

  // ---- spin by clicking; wheel winner == server's player; bidding opens by itself
  await host.click('text=SPIN THE WHEEL');
  await live.waitForSelector('text=DRAWING THE NEXT PLAYER', { timeout: 4000 });
  st = await S(); t('E: phase spinning with a wheel', st.live.phase === 'spinning' && st.live.spin.candidates.length === 12);
  t('E: bids refused during the spin', (await api.cmd(code, tok[0], 'bid', { amount: 2 * LK })).ok === false);
  await live.waitForSelector("text=Who's bidding", { timeout: 12000 });
  st = await S(); t('E: bidding opened automatically after the wheel', st.live.phase === 'bidding');
  const player1 = st.players.find(p => p.id === st.live.playerId);
  t('E: big screen shows the server-picked player', await live.locator(`h2:has-text("${player1.name}")`).count() >= 1);
  t('E: captain phone shows the same player', await c1.locator(`text=${player1.name.toUpperCase()}`).count() >= 1 || await c1.locator(`text=${player1.name}`).count() >= 1);

  // ---- captains bid with real taps
  await c1.waitForSelector('button:has-text("BID")');
  await c1.click('button:has-text("BID")'); await sleep(400);
  t('F: first bid lands at base price', (await S()).live.bids[0]?.amount === 2 * LK);
  t('F: bidder sees "top bid"', await c1.locator('text=You hold the top bid').count() === 1);
  t('F: top bidder cannot outbid self (button disabled)', await c1.locator('button:has-text("YOU LEAD")').isDisabled());
  await c2.click('button:has-text("BID")'); await sleep(400);
  t('F: outbid message on captain 1', await c1.locator('text=You were outbid').count() === 1);
  await c1.click('button:has-text("Jump")'.replace('Jump', 'Jump') + ' >> nth=0'); await sleep(400);
  const bidsNow = (await S()).live.bids.map(x => x.amount);
  t('F: jump bid is above the minimum', bidsNow.length === 3 && bidsNow[2] > bidsNow[1] + 1 * LK, JSON.stringify(bidsNow));
  // host bids on behalf, undoes, calls
  await host.locator('button', { hasText: 'Gold' }).first().click(); await sleep(300);
  t('E: host bid on behalf recorded', (await S()).live.bids.slice(-1)[0].captainId === st.captains[3].id && (await S()).live.bids.slice(-1)[0].byHost === true);
  await host.click('button:has-text("Undo bid")'); await sleep(300);
  t('E: undo removes the host bid', (await S()).live.bids.length === 3);
  await host.click('button:has-text("GOING ONCE")'); await live.waitForSelector('text=GOING ONCE'); t('E: going once on big screen', true);
  await c2.click('button:has-text("BID")'); await sleep(400);
  t('E: a new bid resets the call', (await S()).live.call === 0);
  await host.click('button:has-text("GOING ONCE")'); await host.click('button:has-text("GOING TWICE")'); await host.click('button:has-text("GOING THRICE")');
  t('E: thrice reaches call 3', (await S()).live.call === 3);
  // Space = the big button (SOLD)
  await host.locator('body').click({ position: { x: 5, y: 5 } }); await host.keyboard.press('Space'); await sleep(500);
  st = await S(); t('E: Space key sold the player', st.live.phase === 'sold' && st.players.find(p => p.id === player1.id).status === 'sold');
  await live.waitForSelector('text=SOLD!'); t('E: SOLD stamp on the big screen', true);
  const sold1 = st.players.find(p => p.id === player1.id);
  t('E: buyer is the last bidder at the last price', sold1.teamId === st.live.bids.slice(-1)[0].captainId && sold1.price === st.live.bids.slice(-1)[0].amount);
  // take back then sell again
  await host.click('button:has-text("Take that back")'); await sleep(400);
  st = await S(); t('E: take-back reopens bidding and refunds', st.live.phase === 'bidding' && st.players.find(p => p.id === player1.id).status === 'available');
  await host.click('button:has-text("Sell now")'); await sleep(400);
  t('E: sell now', (await S()).live.phase === 'sold');
  // next → auto-spin in random mode
  await host.click('button:has-text("SPIN FOR NEXT PLAYER")'); await sleep(600);
  st = await S(); t('E: Next starts the next spin', st.live.phase === 'spinning' && st.live.playerId !== player1.id);
  // abort the draw
  await host.waitForSelector('button:has-text("back to the pool")'); await host.click('button:has-text("back to the pool")'); await sleep(500);
  st = await S(); t('E: sending back during a spin resets the screen', st.live.phase === 'idle' && st.live.playerId === null);
  await sleep(7500); st = await S(); t('E: the aborted spin does not reopen bidding later', st.live.phase === 'idle');

  // ---- role-filtered spin
  await host.selectOption('select[aria-label="Draw from"]', 'Bowler');
  await host.locator('button', { hasText: /^Spin$/ }).click(); await sleep(600);
  st = await S(); t('E: role-filtered spin picks a Bowler', st.players.find(p => p.id === st.live.playerId).role === 'Bowler');
  await sleep(7500);
  // ---- no sale
  await host.click('button:has-text("No sale")'); await sleep(400);
  st = await S(); t('E: no sale → unsold', st.live.phase === 'unsold' && st.players.find(p => p.id === st.live.playerId).status === 'unsold');
  await live.waitForSelector('text=UNSOLD'); t('E: UNSOLD stamp on the big screen', true);
  // pick manually from the pool list while unsold is showing
  const manual = st.players.find(p => p.status === 'available');
  await host.locator('li', { hasText: manual.name }).locator('button:has-text("Bring on")').click(); await sleep(500);
  st = await S(); t('E: "Bring on" puts a chosen player on the block', st.live.playerId === manual.id && st.live.phase === 'bidding');

  // ---- squad-full and budget limits through the captain UI
  await api.cmd(code, adminKey, 'player.assign', { id: st.players.find(p => p.status === 'unsold').id, captainId: st.captains[0].id, price: 1 * LK });
  const extra = (await S()).players.filter(p => p.status === 'available' && p.id !== manual.id)[0];
  await api.cmd(code, adminKey, 'player.assign', { id: extra.id, captainId: st.captains[0].id, price: 1 * LK });   // Red now has 2 = maxSquad
  await sleep(500);
  t('F: full squad → "Your squad is full"', await c1.locator('text=Your squad is full').count() === 1);
  t('F: full squad → button disabled', await c1.locator('button:has-text("CAN")').isDisabled());
  const srv = await api.cmd(code, tok[0], 'bid', { amount: 99 * LK }); t('F: server also refuses a full squad', srv.ok === false);
  await api.cmd(code, adminKey, 'captain.budget', { id: st.captains[1].id, mode: 'set', amount: 1 * LK });
  await sleep(500);
  t('F: tiny purse → "Over your budget"', await c2.locator('text=Over your budget').count() === 1);
  await api.cmd(code, adminKey, 'captain.budget', { id: st.captains[1].id, mode: 'set', amount: 50 * LK });

  // ---- screen toggle
  await host.click('button:has-text("Big screen: team board")'); await live.waitForSelector('text=BOARD'); t('E: host switches the big screen to the team board', true);
  await host.click('button:has-text("Big screen: auction")'); await live.waitForSelector("text=Who's bidding"); t('E: and back to the auction', true);

  // ---- finish the round: sell everyone else, then start round 2
  await host.click('button:has-text("back to the pool")'); await sleep(300);
  await api.cmd(code, hostKey, 'reset'.replace('reset', 'unblock')).catch(() => {});
  st = await S();
  for (const p of st.players.filter(p => p.status === 'available')) { await api.cmd(code, adminKey, 'player.setStatus', { id: p.id, status: 'unsold' }); }
  await sleep(700);
  await host.waitForSelector('text=Round 1 is done');
  await host.click('button:has-text("Start round 2")'); await sleep(500);
  st = await S(); t('E: round 2 starts and unsold players return to the pool', st.round === 2 && st.players.filter(p => p.status === 'available').length >= 8, String(st.players.filter(p => p.status === 'available').length));
  t('E: big screen shows round 2', await live.locator('text=round 2').count() >= 1 || await live.locator('text=Round 2').count() >= 1);

  // ---- break via UI
  await host.fill('input[type=number] >> nth=0', '0'); await host.fill('input[type=number] >> nth=1', '12'); await host.click('button:has-text("Start break")');
  await live.waitForSelector('text=Captains: time to plan'); await c1.waitForSelector('text=Captains: time to plan');
  t('E: break shows on big screen and captain phone', true);
  const drawDuring = await api.cmd(code, hostKey, 'draw'); t('E: cannot draw during a break', drawDuring.ok === false);
  await host.click('button:has-text("+ 1 min")'); await sleep(300);
  t('E: +1 min extends', (await S()).live.break.endsAt - (await S()).now > 60_000);
  await host.click('button:has-text("End break now")'); await live.waitForFunction(() => !document.body.innerText.includes('Captains: time to plan')); t('E: End break now restores the auction', true);

  console.log('errors during run:', errors.length);
  await b.close();
  done('UI flows E–F (auctioneer / captain / big screen)', errors);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
