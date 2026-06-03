'use client';

import { useEffect, useState } from 'react';
import OSLayout from './OSLayout';
import DashboardContent from './DashboardContent';

export default function DashboardWrapper() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  return (
    <OSLayout>
      <DashboardContent />
    </OSLayout>
  );
}