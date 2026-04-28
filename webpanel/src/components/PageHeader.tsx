import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, icon, actions }: PageHeaderProps) {
  if (!actions) return null;
  return (
    <div className="flex items-center justify-end gap-2 mb-6">
      {actions}
    </div>
  );
}
