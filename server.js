import express from 'express';
import fetch from 'node-fetch';
import puppeteer from 'puppeteer-core';
import dotenv from 'dotenv';

dotenv.config();  // Load environment variables from .env if available

const app = express();
app.use(express.json());  // Parse JSON request bodies

// Basic health check endpoint
app.get('/health', (req, res) => {
  res.send('OK');
});

// Instagram scraper endpoint (requires IG login credentials in env)
app.get('/api/scrape', async (req, res) => {
  const username = req.query.username;
  if (!username) {
    return res.status(400).json({ error: 'Missing username query parameter' });
  }
  const igUser = process.env.IG_USERNAME;
  const igPass = process.env.IG_PASSWORD;
  if (!igUser || !igPass) {
    return res.status(500).json({ error: 'Instagram credentials not configured in environment' });
  }

  let browser;
  try {
    // Launch puppeteer using external Chromium
    browser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--single-process',
        '--disable-gpu'
      ]
    });
    const page = await browser.newPage();

    // Go to Instagram login page
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });
    // Enter username and password, then submit
    await page.type('input[name=username]', igUser, { delay: 100 });
    await page.type('input[name=password]', igPass, { delay: 100 });
    await Promise.all([
      page.click('button[type=submit]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);

    // Navigate to the target user's profile page
    const profileUrl = `https://www.instagram.com/${username}/`;
    await page.goto(profileUrl, { waitUntil: 'networkidle2' });

    // Scrape profile data using the page's content (Open Graph meta tags for reliability)
    const profileData = await page.evaluate(() => {
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (!ogDesc) {
        return null;
      }
      const content = ogDesc.getAttribute('content');  // e.g. "123 Followers, 456 Following, 789 Posts - See Instagram photos and videos from Name (@user)"
      if (!content) return null;
      const [statsPart, profilePart] = content.split(' - ');
      const stats = statsPart.split(', ');
      // stats[0] = "123 Followers", stats[1] = "456 Following", stats[2] = "789 Posts"
      const followers = stats[0] ? stats[0].split(' ')[0] : null;
      const following = stats[1] ? stats[1].split(' ')[0] : null;
      const posts = stats[2] ? stats[2].split(' ')[0] : null;
      // profilePart = "See Instagram photos and videos from Name (@user)"
      const prefix = 'See Instagram photos and videos from ';
      let fullName = null;
      if (profilePart && profilePart.startsWith(prefix)) {
        // Extract "Name (@user)"
        const nameAndUser = profilePart.substring(prefix.length);
        // Remove the trailing ")" and split at " ("
        const endParenIndex = nameAndUser.lastIndexOf(')');
        const nameSection = endParenIndex !== -1 ? nameAndUser.substring(0, endParenIndex) : nameAndUser;
        const nameParts = nameSection.split(' (');
        fullName = nameParts[0] ? nameParts[0] : null;
      }
      return { followers, following, posts, fullName };
    });

    if (!profileData) {
      return res.status(404).json({ error: 'Failed to scrape profile (profile not found or private)' });
    }

    // Include the username and return scraped data
    profileData.username = username;
    res.json(profileData);
  } catch (error) {
    console.error('Scraping error:', error);
    res.status(500).json({ error: 'Instagram scrape failed', details: error.message });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

// OpenAI Chat endpoint (chat completion)
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.status(400).json({ error: 'Missing message in request body' });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured in environment' });
  }
  // Use GPT-3.5-Turbo by default (can override via env)
  const model = process.env.OPENAI_CHAT_MODEL || 'gpt-3.5-turbo';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    if (!response.ok) {
      // OpenAI API returned an error
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || `OpenAI API error: ${response.status}`;
      return res.status(500).json({ error: msg });
    }
    const data = await response.json();
    const assistantReply = data.choices?.[0]?.message?.content;
    res.json({ reply: assistantReply || '' });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ error: 'Failed to fetch chat completion', details: error.message });
  }
});

// OpenAI Text-to-Speech endpoint (returns an MP3 audio)
app.get('/voz-prueba', async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenAI API key not configured in environment' });
  }
  // Text to convert to speech (Spanish example phrase)
  const text = 'Hola, esta es una prueba de voz generada por OpenAI.';
  // Use OpenAI TTS model "tts-1" and voice "onyx"
  const ttsModel = 'tts-1';
  const voice = 'onyx';

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: ttsModel,
        voice: voice,
        input: text,
        response_format: 'mp3'  // get MP3 audio
      })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err.error?.message || `OpenAI API error: ${response.status}`;
      return res.status(500).json({ error: msg });
    }
    // Get binary audio content
    const audioBuffer = await response.buffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (error) {
    console.error('OpenAI TTS error:', error);
    res.status(500).json({ error: 'Failed to generate speech audio', details: error.message });
  }
});

// Bitly shortener test endpoint
app.get('/bitly-prueba', async (req, res) => {
  const token = process.env.BITLY_ACCESS_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Bitly access token not configured in environment' });
  }
  // Use a default long URL for testing (or take ?url= param if provided)
  const longUrl = req.query.url || 'https://example.com';
  try {
    const response = await fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        long_url: longUrl,
        domain: 'bit.ly'  // use default Bitly domain
      })
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const msg = errData.message || `Bitly API error: ${response.status}`;
      return res.status(response.status).json({ error: msg });
    }
    const data = await response.json();
    const shortLink = data.link;
    res.json({ longUrl: longUrl, shortUrl: shortLink });
  } catch (error) {
    console.error('Bitly error:', error);
    res.status(500).json({ error: 'Bitly shortening failed', details: error.message });
  }
});

// Start the server on the provided PORT (for Render) or default to 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
