import { Icon } from '../icons.jsx';

export default function Placeholder({ icon, title, phase, children }) {
  return (
    <div className="placeholder">
      <div className="placeholder-icon">
        <Icon name={icon} size={56} />
      </div>
      <h1>{title}</h1>
      <div className="badge">{phase}</div>
      <p>{children}</p>
    </div>
  );
}
