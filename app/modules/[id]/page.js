import ModuleDetailClient from '../../components/ModuleDetailClient'

export default async function ModuleDetailPage({ params }) {
  const { id } = await params
  return <ModuleDetailClient moduleId={id} />
}