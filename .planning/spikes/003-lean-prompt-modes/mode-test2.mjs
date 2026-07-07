const B = "http://localhost:4803";
const j = async (p, opts) => (await fetch(B + p, opts)).json();
const post = (p, body) => j(p, {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(body)});
async function turn(message) {
  const events = [];
  const res = await fetch(B + "/events");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  await post("/chat", {message});
  let buf = "", done = false;
  const deadline = Date.now() + 120000;
  while (!done && Date.now() < deadline) {
    const {value, done: d} = await reader.read();
    if (d) break;
    buf += dec.decode(value, {stream:true});
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const m = chunk.match(/^data: (.*)$/m);
      if (m) { const e = JSON.parse(m[1]); events.push(e); if (e.type === "done") done = true; }
    }
  }
  reader.cancel().catch(()=>{});
  return {
    text: events.filter(e=>e.type==="text_delta").map(e=>e.delta).join(""),
    tools: events.filter(e=>e.type==="tool_start").map(e=>e.tool),
  };
}

// 3. toggle research ON (notes stays on)
let m = await post("/modes", {active: ["notes", "research"]});
console.log("[toggle research ON] tokens~", m.tokensApprox, "tools:", m.tools);

// 4. same wiki question again — should now fire wiki_resolve
let r = await turn("Resolve the entity Deocracy in my wiki using wiki_resolve.");
console.log("[research ON] tools used:", r.tools, "| reply:", r.text.slice(0, 250).replace(/\n/g, " "));

// 5. all modes on — token ceiling check
m = await post("/modes", {active: ["notes", "research", "coding"]});
console.log("[ALL modes ON] tokens~", m.tokensApprox, "tools:", m.tools, "| under 5k:", m.tokensApprox < 5000);

// 6. coding mode sanity: grep this spike's own server file
r = await turn("Use grep to find which file in this directory defines MODES, then tell me the filename only.");
console.log("[coding ON] tools used:", r.tools, "| reply:", r.text.slice(0, 200).replace(/\n/g, " "));

// 7. everything OFF — the assistant should still chat, zero tools
m = await post("/modes", {active: []});
console.log("[all OFF] tokens~", m.tokensApprox, "tools:", JSON.stringify(m.tools));
