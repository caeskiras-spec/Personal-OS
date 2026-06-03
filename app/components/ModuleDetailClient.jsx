'use client'

import OSLayout from './OSLayout'
import ModuleView from './ModuleView'

export default function ModuleDetailClient({ moduleId }) {
  return (
    <OSLayout activeRoute={`/modules/${moduleId}`}>
      <ModuleView moduleId={moduleId} />
    </OSLayout>
  )
}