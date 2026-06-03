'use client'

import OSLayout from './OSLayout'
import SettingsScreen from './SettingsScreen'

export default function SettingsClient() {
  return (
    <OSLayout activeRoute="/settings">
      <SettingsScreen />
    </OSLayout>
  )
}