// One-off: derive every constant the lattice reorientation needs (new HEX and
// its edge->interval order, the domain's 12 caps in reading order, the 36-key
// block) numerically, rather than carrying values across the swap by hand.
const CHROMATIC = ["F","Gb","G","Ab","A","Bb","B","C","Db","D","Eb","E"];
const pc = (m,n) => (((7*m+3*n)%12)+12)%12;

// new basis: the old (3,-1)/(3,3) with x and y swapped
const F = [-1,3], B = [3,3];
const pos = (m,n) => [m*F[0]+n*B[0], m*F[1]+n*B[1]];

// --- HEX: swap each old vertex, reverse (the swap flips the winding), then
// rotate the list to start at the vertex with the largest x, as the old one did
const OLD = [[2,0.5],[1,2.5],[-1,1.5],[-2,-0.5],[-1,-2.5],[1,-1.5]];
let hex = OLD.map(([x,y])=>[y,x]).reverse();
const start = hex.indexOf(hex.reduce((a,b)=> b[0]>a[0]?b:a));
hex = [...hex.slice(start), ...hex.slice(0,start)];
console.log("HEX =", JSON.stringify(hex));

const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]], len=v=>Math.hypot(v[0],v[1]);
console.log("  edge lengths:", hex.map((v,i)=>len(sub(hex[(i+1)%6],v)).toFixed(4)).join(" "));
let area=0; for(let i=0;i<6;i++){const a=hex[i],b=hex[(i+1)%6]; area+=a[0]*b[1]-b[0]*a[1];}
console.log("  signed area:", (area/2).toFixed(4), "(positive = CCW; 12 = cell area)");
console.log("  centrally symmetric:", hex.every((v,i)=>{const o=hex[(i+3)%6];return o[0]===-v[0]&&o[1]===-v[1];}));

// --- edge -> interval: each edge's midpoint is half the neighbour vector it crosses
const NB = { P5: pos(1,0), m3: pos(0,1), M3: sub(pos(1,0),pos(0,1)) };
console.log("  neighbour vectors:", JSON.stringify(NB));
for (let i=0;i<3;i++){
  const mid=[(hex[i][0]+hex[(i+1)%6][0])/2,(hex[i][1]+hex[(i+1)%6][1])/2];
  const label=Object.entries(NB).find(([,v])=>v[0]/2===mid[0]&&v[1]/2===mid[1])?.[0] ?? "?";
  console.log(`  HEX[${i}]-HEX[${i+1}] midpoint ${JSON.stringify(mid)} -> ${label}`);
}

// --- the fundamental domain, in reading order
const X0=4.5, Y0=10.5;
const inDomain=[];
for(let m=-40;m<=40;m++) for(let n=-40;n<=40;n++){
  const [x,y]=pos(m,n);
  if(x>=X0&&x<X0+12&&y>=Y0&&y<Y0+12) inDomain.push({m,n,x,y,pc:pc(m,n)});
}
const rows=[...new Set(inDomain.map(c=>c.y))].sort((a,b)=>b-a)   // screen top first
  .map(y=>inDomain.filter(c=>c.y===y).sort((a,b)=>a.x-b.x));
console.log(`\ndomain: ${inDomain.length} caps, ${new Set(inDomain.map(c=>c.pc)).size} pitch classes`);
for(const r of rows) console.log("  "+r.map(c=>`${CHROMATIC[c.pc].padEnd(2)}(${c.m},${c.n})@(${c.x},${c.y})`).join("  "));

// --- the 36-key block: domain caps in columns 3-5, +-12 in x for the outer ones
const KEYS=[["Digit1","Digit2","Digit3","Digit4","Digit5","Digit6","Digit7","Digit8","Digit9"],
            ["KeyQ","KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO"],
            ["KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL"],
            ["KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period"]];
const nodes=[];
rows.forEach((row,r)=>row.forEach((cap,i)=>{
  for(const k of [-1,0,1]){                       // (m-3,n+3) is +12 in x
    const m=cap.m-3*k, n=cap.n+3*k, col=i+3+3*k;
    nodes.push({code:KEYS[r][col],m,n,...{},pc:pc(m,n),hint:k===0,row:r,col,
                x:pos(m,n)[0], y:pos(m,n)[1]});
  }
}));
console.log(`\n${nodes.length} keys, ${new Set(nodes.map(n=>n.pc)).size} pitch classes, ${nodes.filter(n=>n.hint).length} hinted`);
const per=new Map(); for(const n of nodes) per.set(n.pc,(per.get(n.pc)??0)+1);
console.log("  keys per pitch class:", [...new Set(per.values())].join(",") );
console.log("  x range:", Math.min(...nodes.map(n=>n.x)), "..", Math.max(...nodes.map(n=>n.x)),
            " y range:", Math.min(...nodes.map(n=>n.y)), "..", Math.max(...nodes.map(n=>n.y)));
const short=c=>c.replace(/^Key|^Digit/,"");
for(const row of KEYS) console.log("  "+row.map(c=>{
  const n=nodes.find(z=>z.code===c); return `${short(c)}=${CHROMATIC[n.pc].padEnd(2)}${n.hint?"*":" "}`;
}).join(" "));
console.log("  (* = hinted, i.e. inside the fundamental domain)");

// --- triads: do all fully-keyed triads fit a 2x2 key square?
const byCell=new Map(nodes.map(n=>[`${n.m},${n.n}`,n]));
let tri=0, fits=0, egMinor=null, egMajor=null;
for(const n of nodes){
  const lower=[[n.m,n.n],[n.m+1,n.n],[n.m,n.n+1]];
  const upper=[[n.m+1,n.n],[n.m+1,n.n+1],[n.m,n.n+1]];
  for(const [t,kind] of [[lower,"minor"],[upper,"major"]]){
    const ks=t.map(([m,n2])=>byCell.get(`${m},${n2}`));
    if(ks.some(k=>!k)) continue;
    tri++;
    const dr=Math.max(...ks.map(k=>k.row))-Math.min(...ks.map(k=>k.row));
    const dc=Math.max(...ks.map(k=>k.col))-Math.min(...ks.map(k=>k.col));
    if(dr<=1&&dc<=1){ fits++;
      const letters=ks.every(k=>k.row>0);   // prefer an example off the number row
      if(kind==="minor"&&letters&&!egMinor) egMinor=ks;
      if(kind==="major"&&letters&&!egMajor) egMajor=ks; }
  }
}
console.log(`\n${fits}/${tri} fully-keyed triads fit a 2x2 key square`);
const show=ks=>ks.map(k=>`${short(k.code)}=${CHROMATIC[k.pc]}`).join(" + ");
console.log("  minor e.g.", show(egMinor));
console.log("  major e.g.", show(egMajor));
