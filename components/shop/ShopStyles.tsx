export default function ShopStyles() {
  return (
    <style>{`
      .sp { background:#FAFAF8; color:#0F0F0E; font-family:Metropolis,system-ui,sans-serif; flex:1; }
      .sp-wrap { max-width:1100px; margin:0 auto; padding:0 1.5rem; }
      .sp-hero { padding:4rem 0 2rem; }
      .sp-eyebrow { font-size:.7rem; font-weight:600; letter-spacing:.14em; text-transform:uppercase; color:#B6502A; margin-bottom:.75rem; }
      .sp h1 { font-size:clamp(2rem,5vw,3.25rem); font-weight:700; line-height:1.1; margin:0; }
      .sp-sub { color:#6B7280; max-width:560px; margin:.9rem 0 0; line-height:1.6; }
      .sp-bar { display:flex; flex-wrap:wrap; gap:.5rem; align-items:center; justify-content:space-between; margin:1.5rem 0 2rem; }
      .sp-chips { display:flex; flex-wrap:wrap; gap:.5rem; }
      .sp-chip { padding:.45rem .95rem; border-radius:999px; border:1px solid #E8E6E1; background:#fff; font:inherit; font-size:.82rem; font-weight:600; color:#374151; cursor:pointer; }
      .sp-chip.on { background:#0F0F0E; color:#FAFAF8; border-color:#0F0F0E; }
      .sp-cartlink { font-size:.85rem; font-weight:600; color:#0F0F0E; text-decoration:none; border-bottom:1px solid #B6502A; }
      .sp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:1.25rem; padding-bottom:4rem; }
      .sp-card { display:flex; flex-direction:column; background:#fff; border:1px solid #E8E6E1; border-radius:12px; overflow:hidden; text-decoration:none; color:inherit; transition:transform .15s, box-shadow .15s; }
      .sp-card:hover { transform:translateY(-2px); box-shadow:0 12px 28px -14px rgba(0,0,0,.2); }
      .sp-img { position:relative; aspect-ratio:4/3; background:#F1EFEA; display:flex; align-items:center; justify-content:center; color:#9CA3AF; font-size:.8rem; }
      .sp-img img { width:100%; height:100%; object-fit:cover; display:block; }
      .sp-tag { position:absolute; top:.6rem; left:.6rem; background:#B6502A; color:#fff; font-size:.65rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; padding:.25rem .55rem; border-radius:999px; }
      .sp-tag.out { background:#0F0F0E; left:auto; right:.6rem; }
      .sp-body { padding:1rem 1.1rem 1.2rem; display:flex; flex-direction:column; gap:.3rem; flex:1; }
      .sp-cat { font-size:.68rem; font-weight:600; letter-spacing:.1em; text-transform:uppercase; color:#9CA3AF; }
      .sp-name { font-size:1rem; font-weight:700; }
      .sp-tagline { font-size:.85rem; color:#6B7280; line-height:1.45; }
      .sp-price { margin-top:auto; padding-top:.6rem; font-weight:700; }
      .sp-empty { padding:3rem 1rem; text-align:center; color:#6B7280; border:1px dashed #E8E6E1; border-radius:12px; background:#fff; margin-bottom:4rem; }
      .sp-btn { display:inline-flex; align-items:center; justify-content:center; padding:.8rem 1.4rem; border-radius:.5rem; border:none; font:inherit; font-weight:700; font-size:.9rem; cursor:pointer; text-decoration:none; }
      .sp-btn.rust { background:#B6502A; color:#fff; }
      .sp-btn.rust:hover { background:#9E4322; }
      .sp-btn.ghost { background:#fff; color:#0F0F0E; border:1px solid #E8E6E1; }
      .sp-btn:disabled { opacity:.5; cursor:not-allowed; }
      .sp-crumb { padding:1.5rem 0 1rem; font-size:.82rem; }
      .sp-crumb a { color:#6B7280; text-decoration:none; }
      .sp-detail { display:grid; grid-template-columns:1fr; gap:2rem; padding-bottom:3rem; }
      @media(min-width:800px){ .sp-detail { grid-template-columns:1fr 1fr; gap:3rem; } }
      .sp-detail .sp-img { aspect-ratio:1/1; border-radius:14px; overflow:hidden; border:1px solid #E8E6E1; }
      .sp-d-price { font-size:1.5rem; font-weight:700; margin:.75rem 0; }
      .sp-d-desc { color:#374151; line-height:1.7; white-space:pre-line; margin:1rem 0 1.5rem; }
      .sp-label { font-size:.75rem; font-weight:600; letter-spacing:.08em; text-transform:uppercase; color:#6B7280; margin:1rem 0 .5rem; }
      .sp-sizes { display:flex; gap:.5rem; flex-wrap:wrap; }
      .sp-size { min-width:44px; padding:.55rem .8rem; border:1px solid #E8E6E1; background:#fff; border-radius:.5rem; font:inherit; font-weight:600; cursor:pointer; }
      .sp-size.on { background:#0F0F0E; color:#fff; border-color:#0F0F0E; }
      .sp-qty { display:inline-flex; align-items:center; border:1px solid #E8E6E1; border-radius:.5rem; background:#fff; }
      .sp-qty button { width:36px; height:38px; border:none; background:none; font-size:1.1rem; cursor:pointer; }
      .sp-qty span { min-width:28px; text-align:center; font-weight:600; }
      .sp-row { display:flex; gap:.75rem; flex-wrap:wrap; align-items:center; margin-top:1.25rem; }
      .sp-input { width:100%; padding:.75rem .9rem; border:1px solid #D9D6CF; border-radius:.5rem; font:inherit; background:#fff; }
      .sp-input:focus { outline:2px solid #B6502A; outline-offset:0; border-color:#B6502A; }
      .sp-field { display:flex; flex-direction:column; gap:.35rem; margin-bottom:.8rem; font-size:.8rem; font-weight:600; color:#374151; }
      .sp-box { background:#fff; border:1px solid #E8E6E1; border-radius:12px; padding:1.25rem; }
      .sp-err { color:#B91C1C; font-size:.85rem; margin:.5rem 0; }
      .sp-ok { color:#166534; font-size:.9rem; margin:.5rem 0; }
      .sp-related h2 { font-size:1.25rem; margin:0 0 1rem; }
      .sp-cart { display:grid; gap:1.5rem; grid-template-columns:1fr; padding-bottom:4rem; }
      @media(min-width:900px){ .sp-cart { grid-template-columns:1.4fr 1fr; align-items:start; } }
      .sp-line { display:flex; gap:1rem; padding:1rem 0; border-bottom:1px solid #E8E6E1; align-items:center; }
      .sp-line:last-child { border-bottom:none; }
      .sp-thumb { width:64px; height:64px; border-radius:8px; background:#F1EFEA; overflow:hidden; flex-shrink:0; }
      .sp-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
      .sp-opt { display:flex; justify-content:space-between; gap:1rem; padding:.7rem .8rem; border:1px solid #E8E6E1; border-radius:.5rem; margin-bottom:.5rem; cursor:pointer; font-size:.9rem; }
      .sp-opt.on { border-color:#B6502A; background:#FBF3EF; }
      .sp-sum { display:flex; justify-content:space-between; padding:.35rem 0; font-size:.9rem; }
      .sp-sum.total { font-weight:700; font-size:1.05rem; border-top:1px solid #E8E6E1; margin-top:.5rem; padding-top:.8rem; }
      .sp-link { background:none; border:none; padding:0; font:inherit; font-size:.8rem; color:#B6502A; cursor:pointer; text-decoration:underline; }
    `}</style>
  );
}
