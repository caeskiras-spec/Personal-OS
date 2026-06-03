'use client';

import { useEffect, useState } from 'react';
import ModulePage from './ModulePage';
import OSLayout from './OSLayout';

export default function ModulePageWrapper({ moduleId }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <OSLayout>
      <ModulePage moduleId={moduleId} />
    </OSLayout>
  );
}