// api/screenshot.js
const chrome = require('chrome-aws-lambda');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
  const { url, selector } = req.query;

  // 1) 기본 검증
  if (!url) {
    res.status(400).json({ error: 'url 파라미터가 필요합니다.' });
    return;
  }

  // 2) 간단 화이트리스트 (sudanghelp 도메인만 허용)
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('sudanghelp.co.kr')) {
      res.status(400).json({ error: '허용되지 않은 도메인입니다.' });
      return;
    }
  } catch (e) {
    res.status(400).json({ error: '유효하지 않은 URL입니다.' });
    return;
  }

  let browser = null;

  try {
    // 3) Headless Chrome 실행
    browser = await puppeteer.launch({
      args: chrome.args,
      executablePath: await chrome.executablePath,  // chrome-aws-lambda 전용
      headless: chrome.headless,
      defaultViewport: {
        width: 900,
        height: 450,
        deviceScaleFactor: 2
      }
    });

    const page = await browser.newPage();

    // 4) 페이지 이동
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 5) 폰트 로딩 대기
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });

    // 6) 특정 요소만 캡처
    let buffer;
    if (selector) {
      const el = await page.$(selector);
      if (!el) {
        throw new Error(selector "${selector}" 를 찾을 수 없습니다.);
      }
      buffer = await el.screenshot({ type: 'png' });
    } else {
      buffer = await page.screenshot({ type: 'png', fullPage: false });
    }

    await browser.close();
    browser = null;

    // 7) PNG 반환
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(buffer);
  } catch (err) {
    console.error('screenshot error:', err);

    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }

    res.status(500).json({
      error: 'screenshot 실패',
      detail: String(err)
    });
  }
};
