'use client'

import OSLayout from './OSLayout'
import AnalyticsScreen from './AnalyticsScreen'

export default function AnalyticsClient() {
  return (
    <OSLayout activeRoute="/analytics">
      <AnalyticsScreen />
    </OSLayout>
  )
}