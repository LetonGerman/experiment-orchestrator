const puppeteer = require('puppeteer');
const {
  extractDataFromPerformanceTiming,
  getTimeFromPerformanceMetrics,
  extractDataFromPerformanceMetrics,
} = require('./helpers');
const fs = require('fs');
const mkdirp = require('mkdirp');
const lighthouse = require('lighthouse');
const reportGenerator = require('lighthouse/lighthouse-core/report/report-generator');
const psi = require('psi');

describe('Performance Test', async () => {
  let page;
  let browser;
  let client;
  let total = {
    firstMeaningfulPaint: [],
    firstPaint: [],
    firstContentfulPaint: [],
    responseEnd: [],
    domInteractive: [],
    domContentLoadedEventEnd: [],
    loadEventEnd: [],
  };
  let max = {
    firstMeaningfulPaint: 0,
    firstPaint: 0,
    firstContentfulPaint: 0,
    responseEnd: 0,
    domInteractive: 0,
    domContentLoadedEventEnd: 0,
    loadEventEnd: 0,
  };
  let min = {
    firstMeaningfulPaint: 0,
    firstPaint: 0,
    firstContentfulPaint: 0,
    responseEnd: 0,
    domInteractive: 0,
    domContentLoadedEventEnd: 0,
    loadEventEnd: 0,
  };
  let avg = {
    firstMeaningfulPaint: 0,
    firstPaint: 0,
    firstContentfulPaint: 0,
    responseEnd: 0,
    domInteractive: 0,
    domContentLoadedEventEnd: 0,
    loadEventEnd: 0,
  };
  let psiStats;
  let lighthouseAudits;
  const iterations = process.env.ITERATIONS != null ?
      process.env.ITERATIONS :
      25;
  const webpage = process.env.PAGE != null ?
      process.env.PAGE :
      'http://localhost:5000/table/7500';

  beforeAll(async () => {
    browser = await puppeteer.launch({headless: true});
  });

  beforeEach(async () => {
    page = await browser.newPage();
    client = await page.target().createCDPSession();
    jest.setTimeout(120000);
    await client.send('Performance.enable');
    await page.goto(webpage);
  });

  afterEach(async () => {
    await page.close();
  });

  afterAll(async (done) => {
    await browser.close();
    let sum = 0;
    for (let [key, value] of Object.entries(total)) {
      sum = value.reduce((accumulator, currentValue) => accumulator + currentValue);
      avg[key] = sum / iterations;
      min[key] = Math.min(...value);
      max[key] = Math.max(...value);
      console.log('average ' + key, avg[key]);
      console.log('min ' + key, min[key]);
      console.log('max ' + key, max[key]);
    }
    const avgData = JSON.stringify(avg, null, 4);
    const minData = JSON.stringify(avg, null, 4);
    const maxData = JSON.stringify(avg, null, 4);
    const psiData = JSON.stringify(lighthouseAudits, null, 4);
    mkdirp('./stats', function (err) {
      if (err) console.error(err)
      else console.log('pow!')
    });
    fs.writeFileSync('./stats/' + (process.env.FRAMEWORK != null ?
        process.env.FRAMEWORK + '-avg-' + iterations + '.json' : 'avg-' + iterations + '.json'), avgData);
    fs.writeFileSync('./stats/' + (process.env.FRAMEWORK != null ?
        process.env.FRAMEWORK + '-min-' + iterations + '.json' : 'min-' + iterations + '.json'), minData);
    fs.writeFileSync('./stats/' + (process.env.FRAMEWORK != null ?
        process.env.FRAMEWORK + '-max-' + iterations + '.json' : 'max-' + iterations + '.json'), maxData);
    fs.writeFileSync('./stats/' + (process.env.FRAMEWORK != null ?
        process.env.FRAMEWORK + '-psi.json' : 'psi.json'), psiData);
    done();
  });

  for (let i = 0; i < iterations; i++) {
    it('Should be performant', async () => {
      let firstMeaningfulPaint = 0;
      let performanceMetrics;
      while (firstMeaningfulPaint === 0) {
        await page.waitForTimeout(200);
        performanceMetrics = await client.send('Performance.getMetrics');
        firstMeaningfulPaint = getTimeFromPerformanceMetrics(
            performanceMetrics,
            'FirstMeaningfulPaint',
        );
      }

      const FMP = extractDataFromPerformanceMetrics(
          performanceMetrics,
          'FirstMeaningfulPaint',
      );
      //console.log(FMP);
      total.firstMeaningfulPaint.push(FMP.FirstMeaningfulPaint);

      const firstPaint = JSON.parse(
          await page.evaluate(() =>
              JSON.stringify(performance.getEntriesByName('first-paint')),
          ),
      );

      const firstContentfulPaint = JSON.parse(
          await page.evaluate(() =>
              JSON.stringify(
                  performance.getEntriesByName('first-contentful-paint')),
          ),
      );

      total.firstPaint.push(firstPaint[0].startTime);
      total.firstContentfulPaint.push(firstContentfulPaint[0].startTime);

      //console.log('firstPaint', firstPaint);
      //console.log('firstContentfulPaint', firstContentfulPaint);

      const performanceTiming = JSON.parse(
          await page.evaluate(() => JSON.stringify(window.performance.timing)),
      );

      const performanceTimingData = extractDataFromPerformanceTiming(
          performanceTiming,
          'responseEnd',
          'domInteractive',
          'domContentLoadedEventEnd',
          'loadEventEnd',
      );

      //console.log(performanceTimingData);

      total.responseEnd.push(performanceTimingData.responseEnd);
      total.domInteractive.push(performanceTimingData.domInteractive);
      total.domContentLoadedEventEnd.push(performanceTimingData.domContentLoadedEventEnd);
      total.loadEventEnd.push(performanceTimingData.loadEventEnd);

    });
  }

  it('should light a house', async () => {

    const {lhr} = await lighthouse('http://localhost:5000/feed', {
      port: (new URL(browser.wsEndpoint())).port,
      output: 'json',
      logLevel: 'error',
      onlyCategories: ['performance'],
      disableDeviceEmulation: true,
      chromeFlags: ['--disable-mobile-emulation']
    });

    psiStats = await reportGenerator.generateReport(lhr, 'json');

    const audits = JSON.parse(psiStats).audits; // Lighthouse audits
    const firstContentfulPaint = audits['first-contentful-paint'].displayValue;
    const totalBlockingTime = audits['total-blocking-time'].displayValue;
    const timeToInteractive = audits['interactive'].displayValue;
    const byteWeight = audits['total-byte-weight'].displayValue;

    lighthouseAudits = {
      firstContentfulPaint,
      totalBlockingTime,
      timeToInteractive,
      byteWeight
    }

    console.log(`\n
     Lighthouse metrics:
     🎨 First Contentful Paint: ${firstContentfulPaint},
     ⌛️ Total Blocking Time: ${totalBlockingTime},
     👆 Time To Interactive: ${timeToInteractive}`);

    // psiStats = await psi(webpage, {
    //   nokey: 'true',
    //   strategy: 'desktop'
    // });
    // console.log(psiStats);
  });
});
