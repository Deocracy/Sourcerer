// verify SSE streaming works like a browser EventSource would
const res = await fetch("http://localhost:4801/events");
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = "", got = [];
const timer = setTimeout(() => { console.log("TIMEOUT. got:", got.length); process.exit(1); }, 45000);
fetch("http://localhost:4801/chat", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({message:"What notes do I have saved? Just summarize briefly."})});
while (true) {
  const {done, value} = await reader.read();
  if (done) break;
  buf += dec.decode(value, {stream:true});
  let i;
  while ((i = buf.indexOf("\n\n")) >= 0) {
    const chunk = buf.slice(0, i); buf = buf.slice(i+2);
    const m = chunk.match(/^data: (.*)$/m);
    if (m) {
      const e = JSON.parse(m[1]);
      got.push(e.type);
      if (e.type === "text_delta") process.stdout.write(e.delta);
      if (e.type === "done") {
        clearTimeout(timer);
        console.log("\nSSE event types seen:", JSON.stringify(got.reduce((a,t)=>(a[t]=(a[t]||0)+1,a),{})));
        process.exit(0);
      }
    }
  }
}
