'use client';

import { useEffect, useState } from 'react';
import OSLayout from './OSLayout';
import ModuleStore from './ModuleStore';

export default function ModuleStoreWrapper() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return (
    <OSLayout>
      <ModuleStore />
    </OSLayout>
  );
}