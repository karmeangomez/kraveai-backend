// src/utils/geoUtils.js
import axios from 'axios';

export async function getGeo(ip) {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}?fields=66842623`, {
      timeout: 5000
    });
    
    return {
      ip: ip,
      country: response.data.countryCode || 'XX',
      countryName: response.data.country || 'Unknown',
      region: response.data.regionName || 'Unknown',
      city: response.data.city || 'Unknown',
      isp: response.data.isp || 'Unknown',
      proxy: response.data.proxy || false,
      mobile: response.data.mobile || false
    };
  } catch (error) {
    console.error(`⚠️ Error obteniendo geolocalización para ${ip}: ${error.message}`);
    return { 
      ip: ip,
      country: 'XX',
      countryName: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      error: 'No se pudo obtener geolocalización'
    };
  }
}
