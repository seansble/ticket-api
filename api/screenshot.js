import chrome from 'chrome-aws-lambda';
import puppeteer from 'puppeteer-core';

export default async function handler(req, res) {
  // CORS 허용
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let browser = null;

  try {
    const { html, width = 320, height = 430 } = req.body;

    if (!html) {
      return res.status(400).json({ error: 'HTML is required' });
    }

    console.log('Launching browser...');

    // chrome-aws-lambda 사용
    browser = await puppeteer.launch({
      args: chrome.args,
      defaultViewport: {
        width: parseInt(width),
        height: parseInt(height),
        deviceScaleFactor: 3
      },
      executablePath: await chrome.executablePath,
      headless: chrome.headless
    });

    console.log('Browser launched successfully');

    const page = await browser.newPage();

    // HTML 설정
    await page.setContent(html, {
      waitUntil: ['domcontentloaded', 'networkidle0'],
      timeout: 30000
    });

    console.log('Content loaded');

    // 폰트 로딩 대기
    await page.waitForTimeout(500);

    // 스크린샷
    const screenshot = await page.screenshot({
      type: 'png',
      omitBackground: true
    });

    console.log('Screenshot taken successfully');

    await browser.close();
    browser = null;

    // PNG 반환
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.send(screenshot);

  } catch (error) {
    console.error('Screenshot error:', error);
    
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }

    return res.status(500).json({ 
      error: 'Failed to generate screenshot',
      message: error.message,
      stack: error.stack
    });
  }
}
