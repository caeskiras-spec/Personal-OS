import ModuleDetailClient from './ModuleDetailClient'

export default function ModuleDetailServer({ moduleId }) {
  return <ModuleDetailClient moduleId={moduleId} />
}