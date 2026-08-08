export const formatVibeLocation = (vibe) => {
  if (vibe.location_area && vibe.location_city) return `${vibe.location_area}, ${vibe.location_city}`
  if (vibe.location_city) return vibe.location_city
  if (vibe.location_area) return vibe.location_area

  return 'Nearby'
}
