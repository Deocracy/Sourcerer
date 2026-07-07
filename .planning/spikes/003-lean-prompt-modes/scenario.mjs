// Drives the mode-toggle scenario end-to-end and prints observable evidence.
const B = "http://localhost:4803";
const j = async (p, opts) => (await fetch(B + p, opts)).json();
const chatAndWait = async (message) => {
  const events = [];
  const res = await fetch(B + "/events");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  await fetch(B + "/chat", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({message})});
  let buf = "", text = "", tools = [];
  const deadline = Date.now() + 90000;
  outer: while (Date.now() < deadline) {
    const {done, value} = await reader.read();
    if (done) break;
    buf += dec.decode(value, {stream:true});
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const m = buf.slice(0, i).match(/^data: (.*)$/m); buf = buf.slice(i+2);
      if (!m) continue;
      const e = JSON.parse(m[1]);
      if (e.type === "text_delta") text += e.delta;
      if (e.type === "tool_start") tools.push(e.tool);
      if (e.type === "done") break outer;
    }
  }
  reader.cancel();
  return { text: text.trim(), tools };
};

console.log("=== 1. baseline (notes only) ===");
let s = await j("/state");
console.log("prompt tokens:", s.prompt.tokensApprox, "| active tools:", s.activeTools.join(","));

console.log("\n=== 2. wiki question with research OFF ===");
let r = await chatAndWait("Resolve the entity Deocracy in my wiki.");
console.log("tools used:", JSON.stringify(r.tools), "| reply:", r.text.slice(0, 200));

console.log("\n=== 3. toggle research ON, ask again ===");
const m = await j("/modes", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({active:["notes","research"]})});
console.log("modes:", m.active.join(","), "| tools:", m.tools.join(","), "| prompt tokens:", m.tokensApprox);
r = await chatAndWait("Resolve the entity Deocracy in my wiki.");
console.log("tools used:", JSON.stringify(r.tools), "| reply:", r.text.slice(0, 200));

console.log("\n=== 4. ALL modes on — token budget check ===");
const all = await j("/modes", {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({active:["notes","research","coding"]})});
console.log("modes:", all.active.join(","), "| tools:", all.tools.join(","), "| prompt tokens:", all.tokensApprox, all.tokensApprox < 5000 ? "< 5000 ✓" : ">= 5000 ✗");

console.log("\n=== 5. coding mode sanity (read a file) ===");
r = await chatAndWait("Read package.json in the current directory and tell me its name field only.");
console.log("tools used:", JSON.stringify(r.tools), "| reply:", r.text.slice(0, 150));
process.exit(0);
