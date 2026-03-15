'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function SupabaseTestPage() {
  const [status, setStatus] = useState('Teste Verbindung…')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const { data, error } = await supabase.from('documents').select('id').limit(1)

        if (error) {
          setError(error.message)
          setStatus('Fehler')
        } else {
          setStatus(`OK – Antwort erhalten (${data?.length ?? 0} Eintrag(e))`)
        }
      } catch (e: any) {
        setError(e.message ?? String(e))
        setStatus('Fehler')
      }
    })()
  }, [])

  return (
    <main style={{ padding: 16 }}>
      <h1>Supabase Connectivity Test</h1>
      <p>Status: {status}</p>
      {error && <pre style={{ color: 'red' }}>{error}</pre>}
    </main>
  )
}

