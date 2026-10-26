import http from 'node:http';

// A local stand-in for IRCTC that follows the same page flow and DOM hooks as src/selectors.js.
// It lets you rehearse (`irctc-assistant demo`) and lets the tests prove the driver's behaviour,
// including that it never touches credential / captcha / UPI fields. It proves OUR logic, not IRCTC's markup.

const STATIONS = ['NEW DELHI - NDLS', 'MUMBAI CENTRAL - BCT', 'MUMBAI CST - CSTM', 'HOWRAH JN - HWH'];

const page = (body, script = '') => `<!doctype html><meta charset=utf-8><title>Mock IRCTC</title>
<style>body{font:15px system-ui;margin:24px}input,select,button{margin:4px;padding:6px}ul{list-style:none;padding:0;border:1px solid #ccc;display:inline-block}li{padding:4px 8px;cursor:pointer}.pre-avl,.avl-cell{display:inline-block;border:1px solid #888;margin:4px;padding:6px;cursor:pointer}.ui-toast-message{color:#b00}</style>
${body}
<script>
const touch=(id)=>fetch('/__touch',{method:'POST',body:JSON.stringify({id,human:!!window.__human})});
for (const id of ['userid','pwd','captcha','vpa','otp']) document.getElementById(id)?.addEventListener('input',()=>touch(id));
${script}
</script>`;

const searchPage = () => page(`
<a class="loginText" href="#" onclick="document.getElementById('loginModal').style.display='block';return false">LOGIN</a>
<span id="logout" style="display:none">LOGOUT</span>
<div id="loginModal" style="display:none"><input id="userid" placeholder="User Name"><input id="pwd" type="password" placeholder="Password"><input id="otp" placeholder="OTP"><button id="dologin" onclick="fetch('/__test/login',{method:'POST'})">Sign In (demo: any input works)</button></div>
<h2>Plan My Journey</h2>
<p-autocomplete id="origin"><input></p-autocomplete> <p-autocomplete id="destination"><input></p-autocomplete>
<ul id="lb" role="listbox" style="display:none"></ul><br>
<div id="jDate"><input placeholder="dd/mm/yyyy"></div>
<div id="journeyClass" onclick="dd(this,['All Classes','Sleeper (SL)','Third AC (3A)','Second AC (2A)'])">All Classes</div>
<div id="journeyQuota" onclick="dd(this,['GENERAL','LADIES','LOWER BERTH/SR.CITIZEN'])">GENERAL</div>
<ul id="dl" style="display:none"></ul><br>
<button class="search_btn">Search</button><div class="ui-toast-message" id="toast"></div>`, `
const S=${JSON.stringify(STATIONS)};let active=null;
for (const id of ['origin','destination']) { const i=document.querySelector('#'+id+' input');
  i.addEventListener('input',()=>{active=i;const q=i.value.toLowerCase();const lb=document.getElementById('lb');lb.style.display='block';
   lb.innerHTML=S.filter(s=>s.toLowerCase().includes(q)).map(s=>'<li role=option>'+s+'</li>').join('');
   lb.querySelectorAll('li').forEach(li=>li.onclick=()=>{active.value=li.textContent;lb.style.display='none'});}); }
function dd(el,opts){const dl=document.getElementById('dl');dl.style.display='block';dl.innerHTML=opts.map(o=>'<li role=option>'+o+'</li>').join('');
  dl.querySelectorAll('li').forEach(li=>li.onclick=()=>{el.textContent=li.textContent;dl.style.display='none'})}
setInterval(async()=>{const s=await (await fetch('/__state')).json();document.getElementById('logout').style.display=s.loggedIn?'inline':'none'},200);
document.querySelector('.search_btn').onclick=async()=>{
  const q=new URLSearchParams({from:document.querySelector('#origin input').value,to:document.querySelector('#destination input').value,
    date:document.querySelector('#jDate input').value,cls:document.getElementById('journeyClass').textContent,quota:document.getElementById('journeyQuota').textContent});
  const r=await (await fetch('/__search?'+q)).json();
  if(r.ok) location.href='/nget/booking/train-list?'+q; else document.getElementById('toast').textContent=r.msg; };`);

const listPage = () => page(`
<app-train-avl-enq><div class="train-heading"><strong>MUMBAI RAJDHANI (12951)</strong></div>
 <div class="pre-avl" data-cls="3A" onclick="show()">Third AC (3A)</div><div class="pre-avl" onclick="show()">Sleeper (SL)</div>
 <div id="avl" style="display:none"><div class="avl-cell" id="c1">Fri, 25 Dec<div>AVAILABLE-0045</div></div><div class="avl-cell" id="c2">Sat, 26 Dec<div>RAC 4</div></div></div>
 <button id="bn" disabled>Book Now</button></app-train-avl-enq>`, `
function show(){document.getElementById('avl').style.display='block'}
document.querySelectorAll('.avl-cell').forEach(c=>c.onclick=()=>{document.getElementById('bn').disabled=false});
document.getElementById('bn').onclick=()=>location.href='/nget/booking/psgninput';`);

const psgnPage = () => page(`
<div id="rows"></div><a href="#" id="add">+ Add Passenger</a><br>
<input id="mobileNumber" placeholder="Mobile">
<label><input type="checkbox" id="au"> Consider for Auto Upgradation</label>
<label><input type="checkbox" id="co"> Book only if confirm berths are allotted</label><br>
<label><input type="radio" name="ins" id="insyes" checked> Yes, I want insurance</label><label><input type="radio" name="ins" id="insno"> No, I don't want travel insurance</label><br>
<label><input type="radio" name="pm" checked> Pay through Credit &amp; Debit Cards</label><label><input type="radio" name="pm" id="upi"> Pay through BHIM/UPI</label><br>
<button id="go">Continue</button>`, `
const row=()=>{const d=document.createElement('app-passenger');d.innerHTML='<input placeholder="Name"><input formcontrolname="passengerAge">'+
 '<select formcontrolname="passengerGender"><option></option><option>Male</option><option>Female</option><option>Transgender</option></select>'+
 '<select formcontrolname="passengerBerthChoice"><option>No Preference</option><option>Lower</option><option>Middle</option><option>Upper</option></select>';
 document.getElementById('rows').appendChild(d)};row();
document.getElementById('add').onclick=(e)=>{e.preventDefault();row()};
document.getElementById('go').onclick=async()=>{
 const ps=[...document.querySelectorAll('app-passenger')].map(r=>({name:r.querySelector('input').value,age:r.querySelector('[formcontrolname=passengerAge]').value,
  gender:r.querySelector('[formcontrolname=passengerGender]').value,berth:r.querySelector('[formcontrolname=passengerBerthChoice]').value}));
 await fetch('/__booking',{method:'POST',body:JSON.stringify({passengers:ps,mobile:document.getElementById('mobileNumber').value,
  autoUpgrade:document.getElementById('au').checked,confirmOnly:document.getElementById('co').checked,insuranceNo:document.getElementById('insno').checked,upi:document.getElementById('upi').checked})});
 location.href='/nget/booking/reviewBooking'};`);

const reviewPage = () => page(`<h3>Review booking</h3><input id="captcha" placeholder="Captcha"><button id="go" disabled>Continue</button>`, `
const c=document.getElementById('captcha'),g=document.getElementById('go');c.oninput=()=>g.disabled=!c.value;g.onclick=()=>location.href='/nget/payment/bkgPaymentOptions'`);

const payOptsPage = () => page(`<label><input type="radio" name="pm"> Cards</label><label><input type="radio" name="pm" id="upi"> Pay through BHIM/UPI</label><br><button id="pay">Pay &amp; Book</button>`, `
document.getElementById('pay').onclick=()=>location.href='/gateway'`);

const gatewayPage = () => page(`<h3>Payment gateway (mock)</h3><input id="vpa" placeholder="UPI ID"><button id="paynow">Pay</button>`, `
document.getElementById('paynow').onclick=async()=>{await fetch('/__paid',{method:'POST'});location.href='/nget/booking/bkgConfirm'}`);

const confirmPage = (s) => page(`<h2>Booking Confirmed</h2><p>PNR: ${s.pnr}</p><p>Status: CNF / B3 / 22</p>`);

export async function startMock({ openAt = Date.now(), pnr = '4412345678', port = 0 } = {}) {
  const state = { loggedIn: false, openAt, pnr, searches: [], searchAttempts: 0, bookings: [], touches: [], paid: false };
  const body = (req) => new Promise((r) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => r(b)); });
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const send = (code, type, text) => (res.writeHead(code, { 'content-type': type }), res.end(text));
    const html = (t) => send(200, 'text/html; charset=utf-8', t);
    const json = (o) => send(200, 'application/json', JSON.stringify(o));
    switch (url.pathname) {
      case '/nget/train-search': return html(searchPage());
      case '/nget/booking/train-list': return html(listPage());
      case '/nget/booking/psgninput': return html(psgnPage());
      case '/nget/booking/reviewBooking': return html(reviewPage());
      case '/nget/payment/bkgPaymentOptions': return html(payOptsPage());
      case '/gateway': return html(gatewayPage());
      case '/nget/booking/bkgConfirm': return html(confirmPage(state));
      case '/__state': return json({ loggedIn: state.loggedIn });
      case '/__test/login': state.loggedIn = true; return json({ ok: true });
      case '/__search': {
        state.searchAttempts++;
        const q = Object.fromEntries(url.searchParams);
        if (!state.loggedIn) return json({ ok: false, msg: 'Please login' });
        if (Date.now() < state.openAt) return json({ ok: false, msg: 'Booking not yet open for this date' });
        state.searches.push({ ...q, at: Date.now() });
        return json({ ok: true });
      }
      case '/__booking': state.bookings.push(JSON.parse(await body(req))); return json({ ok: true });
      case '/__touch': state.touches.push(JSON.parse(await body(req))); return json({ ok: true });
      case '/__paid': state.paid = true; return json({ ok: true });
      default: return send(404, 'text/plain', 'not found');
    }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, state, close: () => new Promise((r) => server.close(r)) };
}
