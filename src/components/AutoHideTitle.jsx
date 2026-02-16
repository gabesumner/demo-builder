export default function AutoHideTitle({ children, className = '', visible }) {
  return (
    <div className={`title-auto-hide ${!visible ? 'title-hidden' : ''} ${className}`}>
      <div className="overflow-hidden">
        {children}
      </div>
    </div>
  );
}
