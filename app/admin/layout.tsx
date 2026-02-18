export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-wrapper">
      <style>{`
        .admin-wrapper table { display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .admin-wrapper .grid-cols-12 { min-width: 700px; }
        @media (max-width: 768px) {
          .admin-wrapper { padding: 0 4px; }
          .admin-wrapper h1 { font-size: 1.25rem !important; }
          .admin-wrapper .grid { grid-template-columns: 1fr !important; }
          .admin-wrapper button { white-space: nowrap; font-size: 0.75rem; }
          .admin-wrapper select { font-size: 0.75rem; }
          .admin-wrapper .col-span-1, .admin-wrapper .col-span-2, 
          .admin-wrapper .col-span-3, .admin-wrapper .col-span-4 { overflow: hidden; text-overflow: ellipsis; }
        }
      `}</style>
      {children}
    </div>
  );
}