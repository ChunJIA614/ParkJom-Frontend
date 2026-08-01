import{r as o,M as H,j as x,o as E,z as A,A as F,P as U,N as B,O as T}from"./index-CReLBy2f.js";import{c as j}from"./shield-check-iKmQl-1H.js";function S(e,i){if(typeof e=="function")return e(i);e!=null&&(e.current=i)}function W(...e){return i=>{let t=!1;const s=e.map(a=>{const c=S(a,i);return!t&&typeof c=="function"&&(t=!0),c});if(t)return()=>{for(let a=0;a<s.length;a++){const c=s[a];typeof c=="function"?c():S(e[a],null)}}}}function D(...e){return o.useCallback(W(...e),e)}class K extends o.Component{getSnapshotBeforeUpdate(i){const t=this.props.childRef.current;if(E(t)&&i.isPresent&&!this.props.isPresent&&this.props.pop!==!1){const s=t.offsetParent,a=E(s)&&s.offsetWidth||0,c=E(s)&&s.offsetHeight||0,l=getComputedStyle(t),n=this.props.sizeRef.current;n.height=parseFloat(l.height),n.width=parseFloat(l.width),n.top=t.offsetTop,n.left=t.offsetLeft,n.right=a-n.width-n.left,n.bottom=c-n.height-n.top,n.direction=l.direction}return null}componentDidUpdate(){}render(){return this.props.children}}function G({children:e,isPresent:i,anchorX:t,anchorY:s,root:a,pop:c}){var u;const l=o.useId(),n=o.useRef(null),y=o.useRef({width:0,height:0,top:0,left:0,right:0,bottom:0,direction:"ltr"}),{nonce:M}=o.useContext(H),d=c!==!1?((u=e.props)==null?void 0:u.ref)??(e==null?void 0:e.ref):void 0,R=D(n,d);return o.useInsertionEffect(()=>{const{width:h,height:k,top:b,left:f,right:m,bottom:N,direction:P}=y.current;if(i||c===!1||!n.current||!h||!k)return;const g=P==="rtl",$=t==="left"?g?`right: ${m}`:`left: ${f}`:g?`left: ${f}`:`right: ${m}`,w=s==="bottom"?`bottom: ${N}`:`top: ${b}`;n.current.dataset.motionPopId=l;const C=document.createElement("style");M&&(C.nonce=M);const p=a??document.head;return p.appendChild(C),C.sheet&&C.sheet.insertRule(`
          [data-motion-pop-id="${l}"] {
            position: absolute !important;
            width: ${h}px !important;
            height: ${k}px !important;
            ${$}px !important;
            ${w}px !important;
          }
        `),()=>{var r;(r=n.current)==null||r.removeAttribute("data-motion-pop-id"),p.contains(C)&&p.removeChild(C)}},[i]),x.jsx(K,{isPresent:i,childRef:n,sizeRef:y,pop:c,children:c===!1?e:o.cloneElement(e,{ref:R})})}const O=({children:e,initial:i,isPresent:t,onExitComplete:s,custom:a,presenceAffectsLayout:c,mode:l,anchorX:n,anchorY:y,root:M})=>{const d=A(V),R=o.useId(),u=o.useRef(t),h=o.useRef(s);F(()=>{u.current=t,h.current=s});let k=!0,b=o.useMemo(()=>(k=!1,{id:R,initial:i,isPresent:t,custom:a,onExitComplete:f=>{d.set(f,!0);for(const m of d.values())if(!m)return;s&&s()},register:f=>(d.set(f,!1),()=>{var m;d.delete(f),!u.current&&!d.size&&((m=h.current)==null||m.call(h))})}),[t,d,s]);return c&&k&&(b={...b}),o.useMemo(()=>{d.forEach((f,m)=>d.set(m,!1))},[t]),o.useEffect(()=>{!t&&!d.size&&s&&s()},[t]),e=x.jsx(G,{pop:l==="popLayout",isPresent:t,anchorX:n,anchorY:y,root:M,children:e}),x.jsx(U.Provider,{value:b,children:e})};function V(){return new Map}const _=e=>e.key||"";function L(e){const i=[];return o.Children.forEach(e,t=>{o.isValidElement(t)&&i.push(t)}),i}const oe=({children:e,custom:i,initial:t=!0,onExitComplete:s,presenceAffectsLayout:a=!0,mode:c="sync",propagate:l=!1,anchorX:n="left",anchorY:y="top",root:M})=>{const[d,R]=B(l),u=o.useMemo(()=>L(e),[e]),h=l&&!d?[]:u.map(_),k=o.useRef(!0),b=o.useRef(u),f=A(()=>new Map),m=o.useRef(new Set),[N,P]=o.useState(u),[g,$]=o.useState(u);F(()=>{k.current=!1,b.current=u;for(let p=0;p<g.length;p++){const r=_(g[p]);h.includes(r)?(f.delete(r),m.current.delete(r)):f.get(r)!==!0&&f.set(r,!1)}},[g,h.length,h.join("-")]);const w=[];if(u!==N){let p=[...u];for(let r=0;r<g.length;r++){const v=g[r],z=_(v);h.includes(z)||(p.splice(r,0,v),w.push(v))}return c==="wait"&&w.length&&(p=w),$(L(p)),P(u),null}const{forceRender:C}=o.useContext(T);return x.jsx(x.Fragment,{children:g.map(p=>{const r=_(p),v=l&&!d?!1:u===g||h.includes(r),z=()=>{if(m.current.has(r))return;if(f.has(r))m.current.add(r),f.set(r,!0);else return;let I=!0;f.forEach(q=>{q||(I=!1)}),I&&(C==null||C(),$(b.current),l&&(R==null||R()),s&&s())};return x.jsx(O,{isPresent:v,initial:!k.current||t?void 0:!1,custom:i,presenceAffectsLayout:a,mode:c,root:M,onExitComplete:v?void 0:z,anchorX:n,anchorY:y,children:p},r)})})};/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const X=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["line",{x1:"12",x2:"12",y1:"8",y2:"12",key:"1pkeuh"}],["line",{x1:"12",x2:"12.01",y1:"16",y2:"16",key:"4dfq90"}]],re=j("circle-alert",X);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Y=[["path",{d:"M12 6v6l4 2",key:"mmk7yg"}],["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}]],ie=j("clock",Y);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const J=[["circle",{cx:"12",cy:"12",r:"10",key:"1mglay"}],["path",{d:"M12 16v-4",key:"1dtifu"}],["path",{d:"M12 8h.01",key:"e9boi3"}]],ce=j("info",J);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Q=[["path",{d:"M5 12h14",key:"1ays0h"}],["path",{d:"M12 5v14",key:"s699le"}]],ae=j("plus",Q);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const Z=[["path",{d:"M16.247 7.761a6 6 0 0 1 0 8.478",key:"1fwjs5"}],["path",{d:"M19.075 4.933a10 10 0 0 1 0 14.134",key:"ehdyv1"}],["path",{d:"M4.925 19.067a10 10 0 0 1 0-14.134",key:"1q22gi"}],["path",{d:"M7.753 16.239a6 6 0 0 1 0-8.478",key:"r2q7qm"}],["circle",{cx:"12",cy:"12",r:"2",key:"1c9p78"}]],le=j("radio",Z);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const ee=[["path",{d:"m21 21-4.34-4.34",key:"14j7rj"}],["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}]],ue=j("search",ee);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const te=[["path",{d:"M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2",key:"975kel"}],["circle",{cx:"12",cy:"7",r:"4",key:"17ys0d"}]],fe=j("user",te);function de({items:e,activeId:i,onChange:t}){return x.jsx("nav",{className:"lg:hidden fixed bottom-0 left-0 right-0 glass-bar z-50 px-1 pt-1 bottom-nav-safe shadow-[0_-1px_20px_rgba(0,0,0,0.06)]",children:x.jsx("div",{className:"flex items-center justify-around max-w-lg mx-auto",children:e.map(({id:s,icon:a,label:c,dot:l,count:n})=>{const y=i===s;return x.jsxs("button",{type:"button",onClick:()=>t(s),className:`relative flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-2xl transition-all duration-200 ${y?"text-[#007AFF]":"text-[#8e8e93] hover:text-[#48484a]"}`,style:{transitionTimingFunction:"cubic-bezier(0.32, 0.72, 0, 1)"},children:[x.jsx(a,{size:y?22:20,strokeWidth:y?2.5:1.8}),x.jsx("span",{className:`text-[9px] font-semibold ${y?"font-bold":""}`,children:c}),l&&x.jsx("span",{className:"absolute top-1 right-2 w-2 h-2 rounded-full bg-[#34c759] ring-2 ring-white"}),n!=null&&n>0&&x.jsx("span",{className:"absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#ff3b30] text-white text-[8px] font-bold flex items-center justify-center leading-none shadow-sm",children:n>9?"9+":n})]},s)})})})}export{oe as A,de as B,ie as C,ce as I,ae as P,le as R,ue as S,fe as U,re as a};
