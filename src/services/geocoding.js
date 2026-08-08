export const reverseGeocode = async (latitude, longitude) => {
  const params = new URLSearchParams({
    lat: latitude.toString(),
    lon: longitude.toString(),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '14'
  })

  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`)
  if (!response.ok) throw new Error('Could not determine the Vibe area.')

  const data = await response.json()
  const address = data.address || {}

  const area = address.neighbourhood || address.suburb || address.quarter || address.city_district || address.borough || null
  const city = address.city || address.town || address.municipality || address.village || null

  return { area, city }
}
