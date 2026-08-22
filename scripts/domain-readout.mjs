// One-off: what sits inside the debug fundamental-domain square, and where the
// DEFAULT_VIEW transform puts it on screen. For the tonnetz-touch positioning bug.
// Usage: node scripts/domain-readout.mjs [DOMAIN_X0 DOMAIN_Y0]
const CHROMATIC = ["F","Gb","G","Ab","A","Bb","B","C","Db","D","Eb","E"];
const pos = (m,n) => [3*m+3*n, -m+3*n];
const pc  = (m,n) => (((7*m+3*n)%12)+12)%12;

const [CX,CY]=[6,5.5], FIT_SIZE=14;
const DOMAIN_X0 = Number(process.argv[2] ?? 7.5), DOMAIN_Y0 = Number(process.argv[3] ?? 5.5);
const pivotX = CX, pivotY = -CY;

// SVG: rotate(90)=(x,y)->(-y,x); then scale(1,-1)=(u,v)->(u,-v). Combined (x,y)->(-y,-x).
const M = ([x,y]) => [-y,-x];
// pan that lands the domain centre on the pivot (= fit-window centre)
const dc = [DOMAIN_X0+6, -(DOMAIN_Y0+6)];
const md = M([dc[0]-pivotX, dc[1]-pivotY]);
const pan = [-md[0], -md[1]];
const screen = ([x,y]) => {
  const [u,v] = M([x-pivotX, y-pivotY]);
  return [pan[0] + pivotX + u, pan[1] + pivotY + v];
};

console.log(`DOMAIN_X0=${DOMAIN_X0} DOMAIN_Y0=${DOMAIN_Y0}  =>  panX=${pan[0]} panY=${pan[1]}`);

const inside = [];
for (let m=-40;m<=40;m++) for (let n=-40;n<=40;n++) {
  const [x,y] = pos(m,n);
  if (x>=DOMAIN_X0 && x<DOMAIN_X0+12 && y>=DOMAIN_Y0 && y<DOMAIN_Y0+12)
    inside.push({m,n,name:CHROMATIC[pc(m,n)],scr:screen([x,-y])});
}
console.log("caps strictly inside domain square:", inside.length);
const rows = new Map();
for (const c of inside) {
  const k = c.scr[1].toFixed(3);
  if (!rows.has(k)) rows.set(k,[]);
  rows.get(k).push(c);
}
console.log("AS DISPLAYED (screen rows top->bottom, each left->right):");
for (const k of [...rows.keys()].sort((a,b)=>a-b)) {
  const r = rows.get(k).sort((a,b)=>a.scr[0]-b.scr[0]);
  console.log(`  y=${(+k).toFixed(2).padStart(7)}  ` + r.map(c=>`${c.name.padEnd(2)}(${c.m},${c.n})`).join("  "));
}
const corners = [[DOMAIN_X0,-(DOMAIN_Y0+12)],[DOMAIN_X0+12,-(DOMAIN_Y0+12)],
                 [DOMAIN_X0+12,-DOMAIN_Y0],[DOMAIN_X0,-DOMAIN_Y0]].map(screen);
console.log("domain corners on screen:", corners.map(c=>`(${c[0].toFixed(2)},${c[1].toFixed(2)})`).join(" "));
console.log(`fit window: x ${CX-FIT_SIZE/2}..${CX+FIT_SIZE/2}, y ${-(CY+FIT_SIZE/2)}..${-CY+FIT_SIZE/2}`);
