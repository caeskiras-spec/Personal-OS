'use client'

import OSLayout from './OSLayout'
import HomeScreen from './HomeScreen'

export default function HomePageClient() {
  return (
    <OSLayout activeRoute="/home">
      <HomeScreen />
    </OSLayout>
  )
}