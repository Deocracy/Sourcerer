// Scripted validation of the mode registry: toggle → tools + prompt change → behavior changes
const B = "http://localhost:4803";
const j = async (p, opts) => (await fetch(B + p, opts)).json();
const post = (p, body) => j(p, {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(body)});

// SSE capture helper: run one chat turn, return {text, tools}
async function turn(message) {
  const events = [];
  const res = await fetch(B + "/events");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  await post("/chat", {message});
  let buf = "", done = false;
  const deadline = Date.now() + 90000;
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

// 1. baseline: notes only
let s = await j("/state");
console.log("BASELINE modes=", Object.entries(s.modes).filter(([,m])=>m.on).map(([k])=>k), "tokens~", s.prompt.tokensApprox, "tools:", s.activeTools);

// 2. wiki question with research OFF
let r = await turn("Resolve the entity Deocracy in my wiki using wiki_resolve.");
console.log("\n[research OFF] tools used:", r.tools, "| reply:", r.text.slice(0, 200).replace(/\n/g, " "));
