import ShopStyles from '@/components/shop/ShopStyles';

export default function Loading() {
  return (
    <div className="sp">
      <ShopStyles />
      <div className="sp-wrap">
        <div className="sp-hero"><div className="sp-eyebrow">The Ascentor Shop</div></div>
        <div className="sp-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="sp-card" style={{ minHeight: 260, background: '#F1EFEA' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
