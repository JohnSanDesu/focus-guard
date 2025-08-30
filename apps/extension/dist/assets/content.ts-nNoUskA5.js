(function(){function T(o,t){return Array.from({length:t},(e,r)=>(r+.5)*o/t).map(e=>e+(Math.random()-.5)*(o/t)*.4).map(e=>Math.max(0,Math.min(o-1e3,e))).sort((e,r)=>e-r)}function M(o,t){const n=t?.minIntervalMs,e=t?.pollMs??5e3;let r=0,s=location.href,a=document.title;const c=window.setInterval(()=>{const i=Date.now();if((location.href!==s||document.title!==a)&&i-r>=n){s=location.href,a=document.title,r=i;try{o()}catch(m){console.warn("[FocusGuard] nav cb error",m)}}},e);return()=>window.clearInterval(c)}async function G(o=5e3){return new Promise(t=>{let n;const e=()=>{n&&clearTimeout(n),n=window.setTimeout(()=>{r.disconnect(),t()},300)},r=new MutationObserver(()=>{e()});r.observe(document.documentElement,{childList:!0,subtree:!0}),e(),window.setTimeout(()=>{n&&clearTimeout(n),r.disconnect(),t()},o)})}function p(o){return document.querySelector(`meta[name="${o}"]`)?.getAttribute("content")||document.querySelector(`meta[property="${o}"]`)?.getAttribute("content")||""}function I(){const o=Array.from(document.querySelectorAll('script[type="application/ld+json"]')),t=[];for(const n of o){const e=n.textContent||"";e&&t.push(e.slice(0,4e3))}return t.join(`
`)}async function D(){await G();const o=document.title||p("og:title")||p("twitter:title"),t=p("description")||p("og:description")||p("twitter:description"),n=I(),r=(document.querySelector("article, main")?.textContent?.trim()??"").slice(0,600);return{url:location.href,domain:location.hostname,title:o||void 0,description:t||void 0,snippet:r||void 0,jsonld:n||void 0}}let l=null,h=null,_=null;function O(){if(!(l&&h))if(l=document.getElementById("fg-toast-host"),l||(l=document.createElement("div"),l.id="fg-toast-host",Object.assign(l.style,{position:"fixed",inset:"0",pointerEvents:"none",zIndex:"2147483647"}),document.documentElement.appendChild(l)),l.shadowRoot)h=l.shadowRoot;else{h=l.attachShadow({mode:"open"});const o=document.createElement("style");o.textContent=`
      :host { all: initial; }
      /* Container that holds the toast (top-right) */
      .fg-wrap {
        position: fixed;
        top: 16px;
        right: 16px;
        left: auto;
        bottom: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none; /* children enable */
        z-index: 1;
      }
      .fg-toast {
        pointer-events: auto;
        min-width: 260px;
        max-width: min(480px, 92vw);
        background: rgba(28,28,31,0.96);
        color: #fff;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0,0,0,.35);
        overflow: hidden;
        font: 14px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
        border: 1px solid rgba(255,255,255,0.08);
        transform: translateY(-6px);
        opacity: 0;
        animation: fg-enter 160ms ease-out forwards;
      }
      @keyframes fg-enter { to { transform: translateY(0); opacity: 1; } }
      .fg-row {
        display: grid;
        grid-template-columns: 1fr auto;
        align-items: start;
        gap: 8px;
        padding: 12px 12px 8px 12px;
      }
      .fg-msg {
        white-space: pre-wrap;
        word-break: break-word;
      }
      .fg-x {
        background: transparent;
        border: 0;
        color: #cfcfd2;
        font: inherit;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 6px;
      }
      .fg-x:hover { color: #fff; background: rgba(255,255,255,0.08); }
      .fg-actions {
        display: flex;
        gap: 8px;
        padding: 0 12px 12px 12px;
        flex-wrap: wrap;
      }
      .fg-btn {
        border: 0;
        border-radius: 8px;
        padding: 8px 12px;
        cursor: pointer;
        background: #2b2b30;
        color: #fff;
      }
      .fg-btn:hover { background: #3a3a41; }
      .fg-btn.fg-danger { background: #c6362b; }
      .fg-btn.fg-danger:hover { background: #b02e25; }
      @media (max-width: 560px) {
        .fg-wrap { right: 8px; top: 8px; }
        .fg-toast { min-width: 220px; }
      }
    `;const t=document.createElement("div");t.className="fg-wrap",h.append(o,t)}}function C(){if(_){try{_.remove()}catch{}_=null}}function b(o,t,n){try{O();const e=h.querySelector(".fg-wrap");if(!e)return;C();const r=document.createElement("div");r.className="fg-toast";const s=document.createElement("div");s.className="fg-row";const a=document.createElement("div");a.className="fg-msg",a.textContent=o;const c=document.createElement("button");c.className="fg-x",c.setAttribute("aria-label","Close"),c.textContent="×",c.addEventListener("click",()=>C()),s.append(a,c);const i=document.createElement("div");i.className="fg-actions";const w=f=>()=>{try{f&&f()}catch{}C()};(t||[]).slice(0,3).forEach(f=>{const y=document.createElement("button");y.className="fg-btn"+(f.danger?" fg-danger":""),y.textContent=f.label||"OK",y.addEventListener("click",w(f.onClick)),i.appendChild(y)}),r.append(s,i),e.appendChild(r),_=r;const m=n?.durationMs;typeof m=="number"&&isFinite(m)&&m>0,console.log("[FG] toast shown:",{message:o,actions:t?.map(f=>f.label)})}catch{alert(o)}}const S="http://localhost:8787",F=15e3;let d=!1,A=0,k=!1,v=0,u=null;console.log("[FG] content boot");async function L(){return new Promise(o=>{chrome.storage.local.get(["fg_session_endAt"],t=>{const n=t?.fg_session_endAt;o(typeof n=="number"?n:null)})})}async function H(){const o=await L();return!!(o&&o>Date.now())}async function x(){return new Promise(o=>{chrome.storage.local.get(["fg_minutes","fg_consent","fg_profile","fg_goal","fg_session_endAt"],t=>{const n=t?.fg_profile,e=typeof t?.fg_goal=="string"?t.fg_goal.trim():"",r=typeof t?.fg_session_endAt=="number"?t.fg_session_endAt:0;if(!n||!Array.isArray(n.allow)||!Array.isArray(n.block)||!e||!r||r<=Date.now())return o(null);o({minutes:Number(t.fg_minutes)||30,consent:!!t.fg_consent,profile:{allow:n.allow,block:n.block},goal:e,endAt:r})})})}async function j(){return new Promise(o=>{chrome.storage.local.get(["fg_minutes","fg_consent","fg_profile","fg_goal"],t=>{const n=t?.fg_profile||{allow:[],block:[]},e=typeof t?.fg_goal=="string"?t.fg_goal.trim():"";o({minutes:Number(t?.fg_minutes)||30,consent:!!t?.fg_consent,profile:{allow:Array.isArray(n.allow)?n.allow:[],block:Array.isArray(n.block)?n.block:[]},goal:e})})})}function B(o,t,n){return new Promise(e=>{const r=setTimeout(()=>e({ok:!1,status:0,error:"timeout"}),n);try{chrome.runtime.sendMessage({type:"FG_FETCH_JSON",url:o,body:t},s=>{clearTimeout(r),e(s||{ok:!1,status:0,error:"no_response"})})}catch(s){clearTimeout(r),e({ok:!1,status:0,error:String(s)})}})}async function P(o,t,n){const e=new AbortController,r=window.setTimeout(()=>e.abort(),n);try{const s=await fetch(o,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(t),signal:e.signal}),a=await s.json().catch(()=>({}));return{ok:s.ok,status:s.status,data:a}}catch(s){return{ok:!1,status:0,error:String(s)}}finally{clearTimeout(r)}}async function N(o,t,n=5500){const e=await B(`${S}${o}`,t,n);return e.ok||e.status!==0?e:await P(`${S}${o}`,t,n)}async function g(o,t,n){if(!await H()){console.log("[FG] runCheck abort: session inactive (endAt missing/expired)");return}const e=Date.now();if(e-A<F)return;if(A=e,t)try{await chrome.runtime.sendMessage({type:"CAPTURE_FOR_CHECK"})}catch{}const r=await D();let s;try{const i=await N("/score",{norm:r,profile:o,intent:{goal:n}},5500);if(!i.ok)throw new Error(`HTTP ${i.status} ${i.error||""}`);s=i.data}catch{s={verdict:"REVIEW",confidence:.5,categories:[],reasons:["backend_error"],path:"A"}}if(s.verdict==="ALLOW")return;if(s.verdict==="BLOCK"){b("FocusGuard: This looks off-purpose. Stop now?",[{label:"Stop",danger:!0,onClick:()=>{location.href="about:blank"}},{label:"Continue",onClick:()=>{}}]);return}if(k||Date.now()<v){b("FocusGuard: Unsure if this fits your goal. Continue?",[{label:"Continue",onClick:()=>{}},{label:"Stop",danger:!0,onClick:()=>{location.href="about:blank"}},{label:"Snooze 5m",onClick:()=>{setTimeout(()=>g(o,t,n),300*1e3)}}]);return}k=!0;let a=null;try{const i=await N("/judge",{norm:r,profile:o,intent:{goal:n},aJudgment:s},5e3);if(!i.ok)throw new Error(`HTTP ${i.status} ${i.error||""}`);a=i.data}catch{a={verdict:"REVIEW",confidence:.5,categories:[],reasons:["b_error"],path:"B"}}finally{k=!1,v=Date.now()+15e3}if(!(!a||a.verdict==="ALLOW")){if(a.verdict==="BLOCK"){b("FocusGuard: This looks off-purpose. Stop now?",[{label:"Stop",danger:!0,onClick:()=>{location.href="about:blank"}},{label:"Continue",onClick:()=>{}}]);return}b("FocusGuard: Unsure if this fits your goal. Continue?",[{label:"Continue",onClick:()=>{}},{label:"Stop",danger:!0,onClick:()=>{location.href="about:blank"}},{label:"Snooze 5m",onClick:()=>{setTimeout(()=>g(o,t,n),300*1e3)}}])}}async function E(o,t,n,e,r){if(d)return;d=!0,console.log("[FG] session start",{minutes:o,consent:n,allow:t.allow,block:t.block,goal:e}),chrome.runtime.sendMessage({type:"FG_SCHEDULE_SESSION_END",endAt:r}).catch(()=>{}),g(t,n,e).catch(()=>{});const s=Math.max(0,r-Date.now()),a=Math.max(3,Math.floor(s/6e4/5)||1),c=T(s,a),i=Date.now();for(const w of c)setTimeout(()=>g(t,n,e),Math.max(0,i+w-Date.now()));if(u)try{u()}catch{}u=M(()=>g(t,n,e),{minIntervalMs:F})}(async()=>{try{await chrome.runtime.sendMessage({type:"PING"}).catch(()=>{});const o=await x();o&&E(o.minutes,o.profile,o.consent,o.goal,o.endAt),chrome.storage.onChanged.addListener((t,n)=>{n==="local"&&("fg_minutes"in t||"fg_profile"in t||"fg_consent"in t||"fg_goal"in t||"fg_session_endAt"in t)&&x().then(e=>{if(!e){if(d&&"fg_session_endAt"in t){if(d=!1,u){try{u()}catch{}u=null}chrome.runtime.sendMessage({type:"FG_CANCEL_SESSION_END"}).catch(()=>{})}return}d||E(e.minutes,e.profile,e.consent,e.goal,e.endAt)})})}catch(o){console.warn("[FG] content init error",o)}})();chrome.runtime.onMessage.addListener((o,t,n)=>{if(o?.type==="FG_FORCE_CHECK")return console.log("[FG] got FG_FORCE_CHECK"),x().then(e=>{if(!e){console.warn("[FG] no active session (fg_session_endAt missing/expired)."),n({ok:!1,reason:"no_active_session"});return}g(e.profile,e.consent,e.goal).then(()=>n({ok:!0})).catch(r=>{console.warn("[FG] runCheck error",r),n({ok:!1,error:String(r)})})}),!0;if(o?.type==="FG_SESSION_FINISHED"){if(d=!1,u){try{u()}catch{}u=null}chrome.storage.local.remove(["fg_session_endAt","fg_goal"],()=>{}),chrome.runtime.sendMessage({type:"FG_CANCEL_SESSION_END"}).catch(()=>{}),b("FocusGuard session finished. Extend, break, or stop?",[{label:"Extend",onClick:()=>{j().then(e=>{const r=Number(e.minutes)||30,s=(e.goal||"").trim(),a=e.profile||{allow:[],block:[]},c=Date.now()+r*6e4;chrome.storage.local.set({fg_session_endAt:c,fg_goal:s},()=>{chrome.runtime.sendMessage({type:"FG_SCHEDULE_SESSION_END",endAt:c}).catch(()=>{}),E(r,a,!!e.consent,s,c)})})}},{label:"Break",onClick:()=>{}},{label:"Stop",onClick:()=>{}}])}});
//# sourceMappingURL=content.ts-nNoUskA5.js.map
})()
