import type { ComponentType } from 'react';

/** Any lucide-react icon (TextField, ShieldCheck, …) is a component taking `size`. */
type IconComponent = ComponentType<{ size?: number | string }>;

interface Props {
  icon: IconComponent;
  title: string;
  description: string;
}

export default function FeatureCard({ icon: Icon, title, description }: Props) {
  return (
    <div className="feature-card">
      <div className="feature-icon" aria-hidden="true">
        <Icon size={20} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
