"use client";

import { useState, useRef, useCallback } from "react";

const OPENAI_EDIT_URL = "https://api.openai.com/v1/images/edits";

const STYLES = {
  elegant: { label: "Elegant", icon: "🪞", headerBg: "linear-gradient(135deg,#1C1C2E,#2C2C4E)", textColor: "#d0d0ff" },
  casual:  { label: "Casual",  icon: "🌿", headerBg: "linear-gradient(135deg,#2d5a27,#4a7c59)", textColor: "#d0f0dc" },
};

const EMOJI = {
  sofa:"🛋️", lamp:"💡", art:"🖼️", plant:"🪴", rug:"🪞",
  chair:"🪑", basket:"🧺", mirror:"🪞", cushion:"🧶", shelf:"📚", table:"🪵"
};

// Resize + compress image to max 1024px / JPEG 85% before sending to API
function fileToBase64(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 1024;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      res(canvas.toDataURL("image/jpeg", 0.85).split(",")[1]);
    };
    img.onerror = rej;
    img.src = url;
  });
}

function buildImagePrompt(roomType, style, data) {
  const pal = (data.colourPalette || "").replace(/['"]/g, "");
  const lit = (data.lightingPlan  || "").replace(/['"]/g, "");
  const rt  = (roomType || "room").replace(/['"]/g, "");
  if (style === "elegant") {
    return `Photorealistic professional interior design photo of a redesigned ${rt}. Elegant luxury style. ${pal}. ${lit}. Features: marble surfaces, velvet upholstery, brass fixtures, statement chandelier, symmetrical layout, floor-length curtains, curated art, bespoke furniture. 4K ultra detail, soft diffused light, architectural photography.`;
  }
  return `Photorealistic professional interior design photo of a redesigned ${rt}. Warm casual Scandinavian-boho style. ${pal}. ${lit}. Features: natural oak wood, linen textiles, rattan accents, trailing plants, warm Edison bulbs, layered wool rugs, open shelving. 4K ultra detail, warm golden light, interior photography.`;
}

// ── Sub-components ─────────────────────────────────────────────

function Spinner({ size = 30 }) {
  return (
    <div style={{
      width: size, height: size,
      border: "3px solid #E2D9C8", borderTopColor: "#C9A84C",
      borderRadius: "50%", animation: "spin 0.8s linear infinite", flexShrink: 0
    }} />
  );
}

function PurchaseItem({ item }) {
  return (
    <div style={{ display:"flex", gap:"0.5rem", padding:"0.4rem 0", borderBottom:"1px solid #e2d9c8", fontSize:"0.8rem" }}>
      <span style={{ fontSize:"1rem", flexShrink:0 }}>{EMOJI[item.icon] || "✦"}</span>
      <div>
        <div style={{ fontWeight:600 }}>{item.name}</div>
        <div style={{ color:"#6B6760", fontSize:"0.73rem" }}>{item.note}</div>
      </div>
    </div>
  );
}

function StylePanel({ styleName, data, imageUrl, imageLoading, imageError, onSelect }) {
  const s = STYLES[styleName];
  if (!data) return null;
  return (
    <div style={{ borderRadius:12, overflow:"hidden", border:"1.5px solid #e2d9c8" }}>
      <div style={{ background:s.headerBg, padding:"0.7rem 1rem", color:s.textColor, fontSize:"0.74rem", fontWeight:600, letterSpacing:"0.08em", textTransform:"uppercase" }}>
        {s.icon}&nbsp;&nbsp;{s.label} Vision
      </div>

      {/* AI Image */}
      <div style={{ aspectRatio:"16/9", background:"#f0ede8", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden" }}>
        {imageLoading && (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.5rem" }}>
            <Spinner size={26} />
            <span style={{ fontSize:"0.75rem", color:"#6B6760" }}>GPT-Image-1 redesigning your room…</span>
          </div>
        )}
        {!imageLoading && imageError && (
          <div style={{ color:"#a06040", fontSize:"0.76rem", padding:"1rem", textAlign:"center" }}>⚠ {imageError}</div>
        )}
        {!imageLoading && imageUrl && (
          <img src={imageUrl} alt={s.label} style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
        )}
      </div>

      {/* Recommendations */}
      <div style={{ padding:"1rem", background:"#FDFAF5", fontSize:"0.81rem", lineHeight:1.65 }}>
        <h4 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"0.88rem", marginBottom:"0.3rem" }}>✦ Vision</h4>
        <p style={{ marginBottom:"0.8rem", color:"#333" }}>{data.overview}</p>

        <h4 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"0.88rem", marginBottom:"0.25rem" }}>Key Transformations</h4>
        <ul style={{ paddingLeft:"1.1rem", color:"#6B6760", marginBottom:"0.8rem" }}>
          {(data.keyChanges || []).map((c, i) => <li key={i} style={{ marginBottom:"0.2rem" }}>{c}</li>)}
        </ul>

        <h4 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"0.88rem", marginBottom:"0.2rem" }}>🎨 Colour Palette</h4>
        <p style={{ color:"#6B6760", marginBottom:"0.8rem" }}>{data.colourPalette}</p>

        <h4 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"0.88rem", marginBottom:"0.2rem" }}>💡 Lighting Plan</h4>
        <p style={{ color:"#6B6760", marginBottom:"0.8rem" }}>{data.lightingPlan}</p>

        <h4 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"0.88rem", marginBottom:"0.3rem" }}>🛒 Recommended Purchases</h4>
        <div style={{ marginBottom:"0.5rem" }}>
          {(data.purchaseItems || []).map((item, i) => <PurchaseItem key={i} item={item} />)}
        </div>

        <button onClick={onSelect} style={{
          width:"100%", padding:"0.75rem", background:"#1C1C1E", color:"#C9A84C",
          border:"none", borderRadius:8, fontFamily:"inherit", fontSize:"0.82rem",
          cursor:"pointer", marginTop:"0.6rem"
        }}>
          Select {s.label} Style ✦
        </button>
      </div>
    </div>
  );
}

function StepRow({ label, state }) {
  const colors = { idle:"#E2D9C8", active:"#C9A84C", done:"#7A9E87" };
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:"0.5rem", fontSize:"0.78rem",
      color: state==="done" ? "#7A9E87" : state==="active" ? "#1C1C1E" : "#aaa",
      fontWeight: state==="active" ? 600 : 400
    }}>
      <span style={{
        width:8, height:8, borderRadius:"50%", background:colors[state]||colors.idle,
        flexShrink:0, display:"inline-block",
        animation: state==="active" ? "dotpulse 1s infinite" : undefined
      }} />
      {label}
    </div>
  );
}

function RoomCard({ room, onAnalyze, onTabSwitch, onSelectStyle }) {
  const { name, dataUrl, status, errorMsg, steps, loadingMsg, analysis, activeTab, selectedStyle, images, imageLoading, imageError } = room;

  const badgeText  = status==="idle" ? "Awaiting Analysis" : status==="loading" ? "Generating…" : status==="done" ? (selectedStyle ? `${selectedStyle} Selected ✦` : "✦ Design Ready") : "Error — Try Again";
  const badgeColor = selectedStyle==="Elegant" ? "#4a4a8a" : selectedStyle==="Casual" ? "#2d6a42" : status==="done" ? "#2d6a42" : "#6B6760";
  const badgeBg    = selectedStyle==="Elegant" ? "#e8e8f8" : selectedStyle==="Casual"  ? "#e8f2ec" : status==="done" ? "#e8f2ec" : "#F5F0E8";

  return (
    <div style={{ background:"#fff", borderRadius:20, overflow:"hidden", boxShadow:"0 4px 30px rgba(0,0,0,0.08)" }}>
      <div style={{ padding:"1.1rem 1.8rem", borderBottom:"1px solid #E2D9C8", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"1.05rem" }}>🛋️ {name}</span>
        <span style={{ background:badgeBg, color:badgeColor, fontSize:"0.7rem", padding:"0.2rem 0.7rem", borderRadius:20, letterSpacing:"0.1em", textTransform:"uppercase", transition:"all 0.3s" }}>
          {badgeText}
        </span>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", minHeight:320 }}>
        {/* Original photo */}
        <div style={{ position:"relative", background:"#111", overflow:"hidden" }}>
          <img src={dataUrl} alt="Original" style={{ width:"100%", height:"100%", objectFit:"cover", opacity:0.92 }} />
          <span style={{ position:"absolute", top:"0.9rem", left:"0.9rem", background:"rgba(0,0,0,0.55)", color:"#fff", fontSize:"0.68rem", letterSpacing:"0.12em", textTransform:"uppercase", padding:"0.25rem 0.65rem", borderRadius:20, backdropFilter:"blur(4px)" }}>
            Original
          </span>
        </div>

        {/* Design panel */}
        <div style={{ padding:"1.4rem", display:"flex", flexDirection:"column", gap:"0.9rem", overflowY:"auto", maxHeight:700 }}>
          {status === "idle" && (
            <>
              <p style={{ fontSize:"0.78rem", color:"#6B6760", textTransform:"uppercase", letterSpacing:"0.1em" }}>Ready to analyse</p>
              <button onClick={onAnalyze} style={{ width:"100%", padding:"0.85rem", background:"#1C1C1E", color:"#C9A84C", border:"none", borderRadius:10, fontFamily:"inherit", fontSize:"0.88rem", fontWeight:500, cursor:"pointer" }}>
                ✦ Generate Design Concepts
              </button>
            </>
          )}

          {status === "loading" && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"0.75rem", padding:"0.5rem", textAlign:"center" }}>
              <Spinner />
              <p style={{ color:"#6B6760", fontSize:"0.83rem" }}>{loadingMsg}</p>
              <div style={{ display:"flex", flexDirection:"column", gap:"0.4rem", width:"100%", marginTop:"0.2rem" }}>
                <StepRow label="Claude analyses your room"       state={steps.analyse} />
                <StepRow label="GPT-Image-1 redesigns your room (Elegant)" state={steps.elegant} />
                <StepRow label="GPT-Image-1 redesigns your room (Casual)"  state={steps.casual}  />
              </div>
            </div>
          )}

          {status === "error" && (
            <>
              <div style={{ fontSize:"0.8rem", color:"#a06040", background:"#fff0e8", padding:"0.8rem", borderRadius:8, lineHeight:1.55 }}>⚠ {errorMsg}</div>
              <button onClick={onAnalyze} style={{ width:"100%", padding:"0.8rem", background:"#1C1C1E", color:"#C9A84C", border:"none", borderRadius:10, fontFamily:"inherit", fontSize:"0.85rem", cursor:"pointer" }}>
                Try Again
              </button>
            </>
          )}

          {(status === "loading" || status === "done") && analysis && (
            <>
              <div style={{ display:"flex", gap:"0.5rem" }}>
                {["elegant","casual"].map(s => (
                  <button key={s} onClick={() => onTabSwitch(s)} style={{
                    flex:1, padding:"0.48rem", borderRadius:8,
                    border:`1.5px solid ${activeTab===s ? "#1C1C1E" : "#E2D9C8"}`,
                    background: activeTab===s ? "#1C1C1E" : "transparent",
                    color: activeTab===s ? "#C9A84C" : "#1C1C1E",
                    cursor:"pointer", fontFamily:"'Playfair Display',Georgia,serif", fontSize:"0.8rem", transition:"all 0.15s"
                  }}>
                    {STYLES[s].icon} {STYLES[s].label}
                  </button>
                ))}
              </div>
              <StylePanel
                styleName={activeTab}
                data={analysis[activeTab]}
                imageUrl={images[activeTab]}
                imageLoading={imageLoading[activeTab]}
                imageError={imageError[activeTab]}
                onSelect={() => onSelectStyle(STYLES[activeTab].label)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────

export default function DecorApp() {
  const [openaiKey, setOpenaiKey] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("decor_openai_key") || "";
    return "";
  });
  const [keySaved,  setKeySaved]  = useState(() => {
    if (typeof window !== "undefined") return !!localStorage.getItem("decor_openai_key");
    return false;
  });
  const [keyInput,  setKeyInput]  = useState("");
  const [rooms,     setRooms]     = useState([]);
  const [dragging,  setDragging]  = useState(false);
  const fileRef = useRef();

  const saveKey = () => {
    if (!keyInput.startsWith("sk-")) { alert("Please enter a valid OpenAI key (starts with sk-)"); return; }
    localStorage.setItem("decor_openai_key", keyInput);
    setOpenaiKey(keyInput);
    setKeySaved(true);
    setKeyInput("");
  };

  const clearKey = () => {
    localStorage.removeItem("decor_openai_key");
    setKeySaved(false);
    setOpenaiKey("");
  };

  const handleFiles = useCallback(async (files) => {
    for (const file of [...files]) {
      if (!file.type.startsWith("image/")) continue;
      const base64  = await fileToBase64(file);
      const dataUrl = URL.createObjectURL(file);
      const id      = Date.now() + Math.random();
      setRooms(prev => [...prev, {
        id, base64, mime: 'image/jpeg', dataUrl,
        name: file.name.replace(/\.[^.]+$/, "") || "Room",
        status:"idle", errorMsg:"", loadingMsg:"",
        steps: { analyse:"idle", elegant:"idle", casual:"idle" },
        analysis:null, activeTab:"elegant", selectedStyle:null,
        images: { elegant:null, casual:null },
        imageLoading: { elegant:false, casual:false },
        imageError:   { elegant:null,  casual:null  },
      }]);
    }
  }, []);

  const patch     = (id, p)    => setRooms(prev => prev.map(r => r.id===id ? {...r,...p} : r));
  const patchDeep = (id, k, p) => setRooms(prev => prev.map(r => r.id===id ? {...r,[k]:{...r[k],...p}} : r));

  const analyzeRoom = async (room) => {
    if (!openaiKey) { alert("Please enter your OpenAI API key first."); return; }
    const { id, base64, mime } = room;

    patch(id, { status:"loading", errorMsg:"", loadingMsg:"Claude is analysing your room…", steps:{ analyse:"active", elegant:"idle", casual:"idle" }});

    try {
      // Call our Next.js API route (server-side, no CORS)
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mime })
      });

      const parsed = await res.json();
      if (parsed.error) throw new Error(parsed.error);

      patch(id, {
        analysis: parsed,
        loadingMsg: "GPT-Image-1 is redesigning your room…",
        steps: { analyse:"done", elegant:"active", casual:"active" },
        imageLoading: { elegant:true, casual:true },
      });

      await Promise.all([
        genImage(id, "elegant", buildImagePrompt(parsed.roomType, "elegant", parsed.elegant), openaiKey, patchDeep, room.base64),
        genImage(id, "casual",  buildImagePrompt(parsed.roomType, "casual",  parsed.casual),  openaiKey, patchDeep, room.base64),
      ]);

      patch(id, { status:"done", loadingMsg:"", steps:{ analyse:"done", elegant:"done", casual:"done" }});

    } catch (err) {
      console.error(err);
      patch(id, { status:"error", errorMsg: err.message });
    }
  };

  return (
    <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", background:"#F5F0E8", minHeight:"100vh" }}>
      <style>{`
        @keyframes spin     { to{transform:rotate(360deg)} }
        @keyframes fadeIn   { from{opacity:0}to{opacity:1} }
        @keyframes dotpulse { 0%,100%{opacity:1}50%{opacity:0.3} }
      `}</style>

      {/* Header */}
      <header style={{ background:"#1C1C1E", padding:"1rem 2.5rem", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100 }}>
        <div style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"1.5rem", color:"#C9A84C" }}>
          Décor<span style={{ color:"#F5F0E8", fontStyle:"italic" }}>.AI</span>
        </div>
        <div style={{ fontSize:"0.72rem", color:"#6B6760", letterSpacing:"0.15em", textTransform:"uppercase" }}>Interior Design Studio</div>
      </header>

      {/* OpenAI Key Banner */}
      <div style={{ background:"#fff8e8", borderBottom:"2px solid #e8d5a3", padding:"0.85rem 2.5rem", display:"flex", alignItems:"center", gap:"1rem", flexWrap:"wrap" }}>
        <p style={{ fontSize:"0.82rem", color:"#6B6760", flex:1, minWidth:200, margin:0 }}>
          <strong style={{ color:"#1C1C1E" }}>OpenAI API Key</strong> for GPT-Image-1 images. Saved to your browser — enter once.
        </p>
        {!keySaved ? (
          <div style={{ display:"flex", gap:"0.5rem", flex:2, minWidth:240 }}>
            <input
              type="password" value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              onKeyDown={e => e.key==="Enter" && saveKey()}
              placeholder="sk-..."
              style={{ flex:1, padding:"0.5rem 0.85rem", border:"1.5px solid #E2D9C8", borderRadius:8, fontFamily:"inherit", fontSize:"0.83rem", outline:"none", background:"#fff" }}
            />
            <button onClick={saveKey} style={{ padding:"0.5rem 1rem", background:"#1C1C1E", color:"#C9A84C", border:"none", borderRadius:8, fontSize:"0.82rem", cursor:"pointer" }}>
              Save Key
            </button>
          </div>
        ) : (
          <span style={{ fontSize:"0.8rem", color:"#7A9E87", fontWeight:500 }}>
            ✓ Key saved in browser &nbsp;
            <button onClick={clearKey} style={{ background:"none", border:"none", color:"#aaa", fontSize:"0.75rem", cursor:"pointer", textDecoration:"underline", padding:0 }}>
              remove
            </button>
          </span>
        )}
      </div>

      <main style={{ maxWidth:1120, margin:"0 auto", padding:"2.5rem 2rem 5rem" }}>
        {/* Upload Zone */}
        <section style={{ textAlign:"center", marginBottom:"2.5rem" }}>
          <h1 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"2.4rem", fontWeight:400, lineHeight:1.25, marginBottom:"0.4rem" }}>
            Transform your rooms<br/>with <em style={{ color:"#C9A84C" }}>intelligent design</em>
          </h1>
          <p style={{ color:"#6B6760", fontSize:"0.92rem", marginBottom:"1.6rem" }}>
            Upload a room photo → Claude analyses it → GPT-Image-1 renders your redesign in two styles
          </p>
          <div
            onClick={() => fileRef.current.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
            style={{ border:`2px dashed ${dragging?"#C9A84C":"#E2D9C8"}`, borderRadius:16, padding:"2.5rem 2rem", background:dragging?"#fdf8ee":"#FDFAF5", cursor:"pointer", transition:"all 0.2s" }}
          >
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:"none" }} onChange={e => handleFiles(e.target.files)} />
            <div style={{ width:50, height:50, background:"#C9A84C", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 0.9rem", fontSize:"1.3rem" }}>🏠</div>
            <h3 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"1.1rem", marginBottom:"0.3rem" }}>Drop your room photos here</h3>
            <p style={{ color:"#6B6760", fontSize:"0.82rem" }}>JPEG · PNG · WEBP &nbsp;·&nbsp; Multiple rooms supported</p>
          </div>
        </section>

        {/* Room Cards */}
        <div style={{ display:"flex", flexDirection:"column", gap:"2.5rem" }}>
          {rooms.map(room => (
            <RoomCard
              key={room.id}
              room={room}
              onAnalyze={() => analyzeRoom(room)}
              onTabSwitch={tab => patch(room.id, { activeTab:tab })}
              onSelectStyle={style => patch(room.id, { selectedStyle:style })}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

async function genImage(roomId, style, prompt, apiKey, patchDeep, base64) {
  try {
    // Convert base64 to a Blob/File for the multipart request
    const byteChars = atob(base64);
    const byteNums  = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteNums[i] = byteChars.charCodeAt(i);
    const byteArray = new Uint8Array(byteNums);
    const imageBlob = new Blob([byteArray], { type: "image/jpeg" });
    const imageFile = new File([imageBlob], "room.jpg", { type: "image/jpeg" });

    // GPT-Image-1 edits use multipart/form-data
    const formData = new FormData();
    formData.append("model", "gpt-image-1");
    formData.append("image[]", imageFile);
    formData.append("prompt", prompt);
    formData.append("n", "1");
    formData.append("size", "1024x1024");
    formData.append("quality", "medium");

    const res = await fetch(OPENAI_EDIT_URL, {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: formData
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);

    // GPT-Image-1 returns base64 by default
    const imgData = data.data[0];
    const url = imgData.url || `data:image/png;base64,${imgData.b64_json}`;
    patchDeep(roomId, "images",       { [style]: url });
    patchDeep(roomId, "imageLoading", { [style]: false });
  } catch (err) {
    patchDeep(roomId, "imageLoading", { [style]: false });
    patchDeep(roomId, "imageError",   { [style]: err.message });
  }
}
