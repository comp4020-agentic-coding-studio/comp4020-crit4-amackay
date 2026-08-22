// One-off: check the claimed identity of the nodes the domain corner sits between.
const CHROMATIC = ["F","Gb","G","Ab","A","Bb","B","C","Db","D","Eb","E"];
const pos = (m,n) => [3*m+3*n, -m+3*n];
const pc  = (m,n) => (((7*m+3*n)%12)+12)%12;
for (const [m,n] of [[0,2],[1,2],[2,2]])
  console.log(`(${m},${n})  pos ${JSON.stringify(pos(m,n))}  pc ${pc(m,n)}  ${CHROMATIC[pc(m,n)]}`);
console.log("\nmidpoint (0,2)-(1,2):", [(6+9)/2, (6+5)/2], " <- what index.astro uses");
console.log("midpoint (1,2)-(2,2):", [(9+12)/2, (5+4)/2], " <- actual Gb/Db midpoint");
