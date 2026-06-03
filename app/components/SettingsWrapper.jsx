'use client';

import { useEffect, useState } from 'react';
import OSLayout from './OSLayout';
import SettingsContent from './SettingsContent';

export default function SettingsWrapper() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return (
    <OSLayout>
      <SettingsContent />
    </OSLayout>
  );
}