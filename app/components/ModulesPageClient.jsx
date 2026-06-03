'use client'

import OSLayout from './OSLayout'
import ModuleStore from './ModuleStore'

export default function ModulesPageClient() {
  return (
    <OSLayout activeRoute="/modules">
      <ModuleStore />
    </OSLayout>
  )
}