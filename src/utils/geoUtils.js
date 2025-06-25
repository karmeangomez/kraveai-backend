// src/utils/geoUtils.js
import axios from 'axios';

export async function getGeo(ip) {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}?fields=66842623`, {
      timeout: 5000
    });

    const data = response.data || {};

    return {
      ip,
      country: data.countryCode || 'XX',
      countryName: data.country || 'Unknown',
      region: data.regionName || 'Unknown',
      city: data.city || 'Unknown',
      isp: data.isp || 'Unknown',
      proxy: data.proxy || false,
      mobile: data.mobile || false
    };
  } catch (error) {
    console.error(`⚠️ Error obteniendo geolocalización para ${ip}: ${error.message}`);
    return {
      ip,
      country: 'XX',
      countryName: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      isp: 'Unknown',
      proxy: false,
      mobile: false,
      error: 'No se pudo obtener geolocalización'
    };
  }
}
