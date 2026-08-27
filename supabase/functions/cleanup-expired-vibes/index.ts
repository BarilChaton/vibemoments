import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        error: 'Missing Supabase environment variables'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  try {
    const { data: expiredVibes, error: fetchError } = await supabase
      .from('vibes')
      .select('id, media_path, thumbnail_path')
      .lte('expires_at', new Date().toISOString())
      .limit(100)

    if (fetchError) {
      console.error('Expired Vibe fetch failed:', fetchError)

      return new Response(
        JSON.stringify({
          stage: 'fetch',
          error: fetchError
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (!expiredVibes?.length) {
      return new Response(
        JSON.stringify({
          deletedVibes: 0,
          deletedFiles: 0,
          message: 'No expired Vibes found'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const mediaPaths = expiredVibes.flatMap((vibe) => {
      const paths = []

      if (vibe.media_path) paths.push(vibe.media_path)
      if (vibe.thumbnail_path) paths.push(vibe.thumbnail_path)

      return paths
    })

    if (mediaPaths.length) {
      const { data: deletedFiles, error: storageError } = await supabase.storage
        .from('vibes')
        .remove(mediaPaths)

      if (storageError) {
        console.error('Storage cleanup failed:', storageError)

        return new Response(
          JSON.stringify({
            stage: 'storage',
            error: storageError,
            paths: mediaPaths
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }
    }

    const vibeIds = expiredVibes.map((vibe) => vibe.id)

    const { error: deleteError } = await supabase
      .from('vibes')
      .delete()
      .in('id', vibeIds)

    if (deleteError) {
      console.error('Vibe deletion failed:', deleteError)

      return new Response(
        JSON.stringify({
          stage: 'database-delete',
          error: deleteError
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({
        deletedVibes: vibeIds.length,
        deletedFiles: mediaPaths.length,
        vibeIds,
        mediaPaths
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Expired Vibe cleanup failed:', error)

    return new Response(
      JSON.stringify({
        error
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
})