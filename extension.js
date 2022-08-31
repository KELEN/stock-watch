const vscode = require("vscode");
const axios = require("axios");
const dayjs = require("dayjs");
const iconvLite = require('iconv-lite')
const baseUrl = "https://api.money.126.net/data/feed/";
let statusBarItems = {};
let stockCodes = [];
let updateInterval = 10000;
let timer = null;
let showTimer = null;

const { decode } = iconvLite;

function activate(context) {
  initShowTimeChecker();
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(handleConfigChange));
}
exports.activate = activate;

function deactivate() {}
exports.deactivate = deactivate;


function init() {
  if (isShowTime()) {
    stockCodes = getStockCodes();
    updateInterval = getUpdateInterval();
    fetchAllData();
  } else {
    hideAllStatusBar();
  }
}

function initShowTimeChecker() {
  showTimer && clearInterval(showTimer);
  showTimer = setInterval(() => {
		console.log('check show ' + isShowTime())
    if (isShowTime()) {
      init();
    } else {
      timer && clearInterval(timer);
      hideAllStatusBar();
    }
  }, updateInterval)
}

function hideAllStatusBar() {
  Object.keys(statusBarItems).forEach((item) => {
    statusBarItems[item].hide();
    statusBarItems[item].dispose();
		delete statusBarItems[item];
  });
}

function handleConfigChange() {
  timer && clearInterval(timer);
  // showTimer && clearInterval(showTimer);
  const codes = getStockCodes();
  Object.keys(statusBarItems).forEach((item) => {
    if (codes.indexOf(item) === -1) {
      statusBarItems[item].hide();
      statusBarItems[item].dispose();
      delete statusBarItems[item];
    }
  });
  init();
}

function getStockCodes() {
  const config = vscode.workspace.getConfiguration();
  const stocks = config.get("stock-watch.stocks");
  return stocks.map((configItem) => {
    const [code] = configItem.split('|');
    // console.log('code is ', code);
    // if (isNaN(code[0])) {
    //   if (code.toLowerCase().indexOf("us_") > -1) {
    //     return code.toUpperCase();
    //   } else if (code.indexOf("hk") > -1) {
    //     return code;
    //   } else {
    //     return code.toLowerCase().replace("sz", "1").replace("sh", "0");
    //   }
    // } else {
    //   return(code[0] === "6" ? "0" : "1") + code;
    // }
    return code;
  });
}

function getUpdateInterval() {
  const config = vscode.workspace.getConfiguration();
  return config.get("stock-watch.updateInterval");
}

function isShowTime() {
  const config = vscode.workspace.getConfiguration();
  const configShowTime = config.get("stock-watch.showTime");
  if (configShowTime.length === 0) return true;
  let showTime = [0, 23];
  if (Array.isArray(configShowTime) && configShowTime.length === 2 && configShowTime[0] <= configShowTime[1]) {
    showTime = configShowTime;
  }
  const isWeekend = dayjs().day() === 6 || dayjs().day() === 0; // 周六日不显示了
  return !isWeekend && (dayjs().isAfter(dayjs().hour(showTime[0]).format("YYYY-MM-DD HH:00:00")) && dayjs().isBefore(dayjs().hour(showTime[1]).format("YYYY-MM-DD HH:00:00")));
}

function getItemText(item) {
  const config = vscode.workspace.getConfiguration();
  const stocks = config.get("stock-watch.stocks");
  const match = stocks.find(configItem => {
    const [code] = configItem.split('|');
    return code === item.code;
  })
  let money = '';
  if (match) {
    const [code, price, num] = match.split('|');
    // 赚取
    if (price && num) {
      money = Math.floor((item.price - price) * num);
    }
  }
  // console.log('money', money)
  return `「${
    item.name
  }」${
    keepDecimal(item.price, calcFixedNumber(item))
  } ${
    keepDecimal(item.percent, 2)
  }% ${money ? `「${money}」`: ''}`.trim();
}

function getTooltipText(item) {
  const config = vscode.workspace.getConfiguration();
  const stocks = config.get("stock-watch.stocks");
  const match = stocks.find(configItem => {
    const [code] = configItem.split('|');
    return code === item.code;
  })
  console.log(item, match, stocks);
  let moneyInfo = '';
  if (match) {
    const [code, price, num] = match.split('|');
    // 赚取
    if (price && num) {
      const money = Math.floor((item.price - price) * num);
      moneyInfo = `盈利：${money}\n`
    }
  }
  return `【${item.name}】${
    item.code
  }\n${moneyInfo}涨跌：${
    item.updown
  }   百分：${
    keepDecimal(item.percent, 2)
  }%\n最高：${
    item.high
  }   最低：${
    item.low
  }\n今开：${
    item.open
  }   昨收：${
    item.yestclose
  }`;
}

function getItemColor(item) {
  const config = vscode.workspace.getConfiguration();
  const riseColor = config.get("stock-watch.riseColor");
  const fallColor = config.get("stock-watch.fallColor");

  return item.percent >= 0 ? riseColor : fallColor;
}

const randHeader = () => {
  const head_connection = ['Keep-Alive', 'close'];
  const head_accept = ['text/html, application/xhtml+xml, */*'];
  const head_accept_language = [
    'zh-CN,fr-FR;q=0.5',
    'en-US,en;q=0.8,zh-Hans-CN;q=0.5,zh-Hans;q=0.3',
  ];
  const head_user_agent = [
    'Opera/8.0 (Macintosh; PPC Mac OS X; U; en)',
    'Opera/9.27 (Windows NT 5.2; U; zh-cn)',
    'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Win64; x64; Trident/4.0)',
    'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1; Trident/4.0)',
    'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; WOW64; Trident/6.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; InfoPath.2; .NET4.0C; .NET4.0E)',
    'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; WOW64; Trident/6.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; InfoPath.2; .NET4.0C; .NET4.0E; QQBrowser/7.3.9825.400)',
    'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; WOW64; Trident/6.0; BIDUBrowser 2.x)',
    'Mozilla/5.0 (Windows; U; Windows NT 5.1) Gecko/20070309 Firefox/2.0.0.3',
    'Mozilla/5.0 (Windows; U; Windows NT 5.1) Gecko/20070803 Firefox/1.5.0.12',
    'Mozilla/5.0 (Windows; U; Windows NT 5.2) Gecko/2008070208 Firefox/3.0.1',
    'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.8.1.12) Gecko/20080219 Firefox/2.0.0.12 Navigator/9.0.0.6',
    'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/28.0.1500.95 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; SLCC2; .NET CLR 2.0.50727; .NET CLR 3.5.30729; .NET CLR 3.0.30729; Media Center PC 6.0; .NET4.0C; rv:11.0) like Gecko)',
    'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:21.0) Gecko/20100101 Firefox/21.0 ',
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.1 (KHTML, like Gecko) Maxthon/4.0.6.2000 Chrome/26.0.1410.43 Safari/537.1 ',
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.1 (KHTML, like Gecko) Chrome/21.0.1180.92 Safari/537.1 LBBROWSER',
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.75 Safari/537.36',
    'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/536.11 (KHTML, like Gecko) Chrome/20.0.1132.11 TaoBrowser/3.0 Safari/536.11',
    'Mozilla/5.0 (Windows NT 6.3; WOW64; Trident/7.0; rv:11.0) like Gecko',
    'Mozilla/5.0 (Macintosh; PPC Mac OS X; U; en) Opera 8.0',
  ];
  const result = {
    Connection: head_connection[0],
    Accept: head_accept[0],
    'Accept-Language': head_accept_language[1],
    'User-Agent': head_user_agent[Math.floor(Math.random() * 10)],
  };
  return result;
};

const calcFixedPriceNumber = (
  open,
  yestclose,
  price,
  high,
  low
) => {
  let reg = /0+$/g;
  open = open.replace(reg, '');
  yestclose = yestclose.replace(reg, '');
  price = price.replace(reg, '');
  high = high.replace(reg, '');
  low = low.replace(reg, '');
  let o = open.indexOf('.') === -1 ? 0 : open.length - open.indexOf('.') - 1;
  let yc = yestclose.indexOf('.') === -1 ? 0 : yestclose.length - yestclose.indexOf('.') - 1;
  let p = price.indexOf('.') === -1 ? 0 : price.length - price.indexOf('.') - 1;
  let h = high.indexOf('.') === -1 ? 0 : high.length - high.indexOf('.') - 1;
  let l = low.indexOf('.') === -1 ? 0 : low.length - low.indexOf('.') - 1;
  let max = Math.max(o, yc, p, h, l);
  if (max > 3) {
    max = 2; // 接口返回的指数数值的小数位为4，但习惯两位小数
  }
  return max;
};

const formatNumber = (val = 0, fixed = 2, format = true) => {
  const num = +val;
  if (format) {
    if (num > 1000 * 10000) {
      return (num / (10000 * 10000)).toFixed(fixed) + '亿';
    } else if (num > 1000) {
      return (num / 10000).toFixed(fixed) + '万';
    }
  }
  return `${num.toFixed(fixed)}`;
};

function dealData(resp) {
  const splitData = resp.data.split(';\n');
  const arr = [];
  let aStockCount = 0;
  let noDataStockCount = 0;
  for (let i = 0; i < splitData.length - 1; i++) {
    const code = splitData[i].split('="')[0].split('var hq_str_')[1];
    const params = splitData[i].split('="')[1].split(',');
    let type = code.substr(0, 2) || 'sh';
    let symbol = code.substr(2);
    let stockItem;
    let fixedNumber = 2;
    if (params.length > 1) {
      if (/^(sh|sz)/.test(code)) {
        let open = params[1];
        let yestclose = params[2];
        let price = params[3];
        let high = params[4];
        let low = params[5];
        fixedNumber = calcFixedPriceNumber(open, yestclose, price, high, low);
        stockItem = {
          code,
          name: params[0],
          open: formatNumber(open, fixedNumber, false),
          yestclose: formatNumber(yestclose, fixedNumber, false),
          price: formatNumber(price, fixedNumber, false),
          low: formatNumber(low, fixedNumber, false),
          high: formatNumber(high, fixedNumber, false),
          volume: formatNumber(params[8], 2),
          amount: formatNumber(params[9], 2),
          time: `${params[30]} ${params[31]}`,
          percent: '',
        };
        aStockCount += 1;
      } else if (/^gb_/.test(code)) {
        symbol = code.substr(3);
        let open = params[5];
        let yestclose = params[26];
        let price = params[1];
        let high = params[6];
        let low = params[7];
        fixedNumber = calcFixedPriceNumber(open, yestclose, price, high, low);
        stockItem = {
          code,
          name: params[0],
          open: formatNumber(open, fixedNumber, false),
          yestclose: formatNumber(yestclose, fixedNumber, false),
          price: formatNumber(price, fixedNumber, false),
          low: formatNumber(low, fixedNumber, false),
          high: formatNumber(high, fixedNumber, false),
          volume: formatNumber(params[10], 2),
          amount: '接口无数据',
          percent: '',
        };
        type = code.substr(0, 3);
        noDataStockCount += 1;
      } else if (/^usr_/.test(code)) {
        symbol = code.substr(4);
        let open = params[5];
        let yestclose = params[26];
        let price = params[1];
        let high = params[6];
        let low = params[7];
        fixedNumber = calcFixedPriceNumber(open, yestclose, price, high, low);
        stockItem = {
          code,
          name: params[0],
          open: formatNumber(open, fixedNumber, false),
          yestclose: formatNumber(yestclose, fixedNumber, false),
          price: formatNumber(price, fixedNumber, false),
          low: formatNumber(low, fixedNumber, false),
          high: formatNumber(high, fixedNumber, false),
          volume: formatNumber(params[10], 2),
          amount: '接口无数据',
          percent: '',
        };
        type = code.substr(0, 4);
        usStockCount += 1;
      } else if (/nf_/.test(code)) {
        /* 解析格式，与股票略有不同
        var hq_str_V2201="PVC2201,230000,
        8585.00, 8692.00, 8467.00, 8641.00, // params[2,3,4,5] 开，高，低，昨收
        8673.00, 8674.00, // params[6, 7] 买一、卖一价
        8675.00, // 现价 params[8]
        8630.00, // 均价
        8821.00, // 昨日结算价【一般软件的行情涨跌幅按这个价格显示涨跌幅】（后续考虑配置项，设置按收盘价还是结算价显示涨跌幅）
        109, // 买一量
        2, // 卖一量
        289274, // 持仓量
        230643, //总量
        连, // params[8 + 7] 交易所名称 ["连","沪", "郑"]
        PVC,2021-11-26,1,9243.000,8611.000,9243.000,8251.000,9435.000,8108.000,13380.000,8108.000,445.541";
        */
        let name = params[0];
        let open = params[2];
        let high = params[3];
        let low = params[4];
        let yestclose = params[5];
        let price = params[8];
        let yestCallPrice = params[8 + 2];
        let volume = params[8 + 6]; // 成交量
          //股指期货
        const stockIndexFuture = /nf_IC/.test(code)
          || /nf_IF/.test(code)
          || /nf_IH/.test(code)
          || /nf_TF/.test(code) // 五债
          || /nf_TS/.test(code) // 二债
          || /nf_T\d+/.test(code) // 十债
          ;
        if(stockIndexFuture){
          // 0 开盘       1 最高      2  最低     3 收盘
          // ['5372.000', '5585.000', '5343.000', '5581.600',
          // 4 成交量                 6 持仓量
          // '47855', '261716510.000', '124729.000', '5581.600',
          // '0.000', '5849.800', '4786.200', '0.000', '0.000',
          //  13 昨收盘   14 昨天结算
          // '5342.800', '5318.000', '126776.000', '5581.600',
          // '4', '0.000', '0', '0.000', '0', '0.000', '0', '0.000', '0', '5582.000', '2', '0.000', '0', '0.000', '0', '0.000', '0', '0.000', '0', '2022-04-29', '15:00:00', '300', '0', '', '', '', '', '', '', '', '',
          // 48        49  名称
          // '5468.948', '中证500指数期货2206"']

          name = params[49].slice(0, -1); // 最后一位去掉 "
          open = params[0];
          high = params[1];
          low = params[2];
          price = params[3];
          volume = params[4];
          yestclose = params[13];
          yestCallPrice = params[14];
        }
        fixedNumber = calcFixedPriceNumber(open, yestclose, price, high, low);
        stockItem = {
          code: code,
          name: name,
          open: formatNumber(open, fixedNumber, false),
          yestclose: formatNumber(yestclose, fixedNumber, false),
          yestcallprice: formatNumber(yestCallPrice, fixedNumber, false),
          price: formatNumber(price, fixedNumber, false),
          low: formatNumber(low, fixedNumber, false),
          high: formatNumber(high, fixedNumber, false),
          volume: formatNumber(volume, 2),
          amount: '接口无数据',
          percent: '',
        };
        type = 'nf_';
      } else if (/hf_/.test(code)) {
        // 海外期货格式
        // 0 当前价格
        // ['105.306', '',
        //  2  买一价  3 卖一价  4  最高价   5 最低价
        // '105.270', '105.290', '105.540', '102.950',
        //  6 时间   7 昨日结算价  8 开盘价  9 持仓量
        // '15:51:34', '102.410', '103.500', '250168.000',
        // 10 买 11 卖 12 日期      13 名称  14 成交量
        // '5', '2', '2022-05-04', 'WTI纽约原油2206', '28346"']
        // 当前价格
        let price = params[0];
        // 名称
        let name = params[13];
        let open = params[8];
        let high = params[4];
        let low = params[5];
        let yestclose = params[7]; // 昨收盘
        let yestCallPrice = params[7]; // 昨结算
        let volume = params[14].slice(0, -1); // 成交量。slice 去掉最后一位 "
        fixedNumber = calcFixedPriceNumber(open, yestclose, price, high, low);

        stockItem = {
          code: code,
          name: name,
          open: formatNumber(open, fixedNumber, false),
          yestclose: formatNumber(yestclose, fixedNumber, false),
          yestcallprice: formatNumber(yestCallPrice, fixedNumber, false),
          price: formatNumber(price, fixedNumber, false),
          low: formatNumber(low, fixedNumber, false),
          high: formatNumber(high, fixedNumber, false),
          volume: formatNumber(volume, 2),
          amount: '接口无数据',
          percent: '',
        };
        type = 'hf_';
      }
      if (stockItem) {
        const { yestclose, open } = stockItem;
        let { price } = stockItem;
        /*  if (open === price && price === '0.00') {
        stockItem.isStop = true;
      } */

        // 竞价阶段部分开盘和价格为0.00导致显示 -100%
        try {
          if (Number(open) <= 0) {
            price = yestclose;
          }
        } catch (err) {
          console.error(err);
        }
        stockItem.showLabel = this.showLabel;
        stockItem.isStock = true;
        stockItem.type = type;
        stockItem.symbol = symbol;
        stockItem.updown = formatNumber(+price - +yestclose, fixedNumber, false);
        stockItem.percent =
          (stockItem.updown >= 0 ? '+' : '-') +
          formatNumber((Math.abs(stockItem.updown) / +yestclose) * 100, 2, false);

      }
    } else {
      // 接口不支持的
      noDataStockCount += 1;
      stockItem = {
        id: code,
        name: `接口不支持该股票 ${code}`,
        showLabel: this.showLabel,
        isStock: true,
        percent: '',
        type: 'nodata',
        contextValue: 'nodata',
      };
    }
    arr.push(stockItem);
  }
  return arr;
}

function fetchAllData() {
  const url = `https://hq.sinajs.cn/list=${stockCodes.join(',')}`;
  console.log('featch data url ', url);
  if (isShowTime()) {
    axios.get(url, {
      responseType: 'arraybuffer',
      transformResponse: [
        (data) => {
          const body = decode(data, 'GB18030');
          return body;
        },
      ],
      headers: Object.assign(randHeader(), {
        Referer: 'http://finance.sina.com.cn/'
      }),
    }).then((rep) => {
      console.log('==============')
      console.log(rep);
      const data = dealData(rep);
      displayData(data)
      // try {
      //   const result = JSON.parse(rep.data.slice(2, -2));
      //   let data = [];
      //   Object.keys(result).map((item) => {
      //     if (! result[item].code) {
      //       result[item].code = item; // 兼容港股美股
      //     }data.push(result[item]);
      //   });
      //   displayData(data);
      // } catch (error) {}
    }, (error) => {
      console.error(error);
    }).catch((error) => {
      console.error(error);
    });
  }
}

function displayData(data) {
  data.map((item) => {
    const key = item.code;
    if (statusBarItems[key]) {
      statusBarItems[key].text = getItemText(item);
      statusBarItems[key].color = getItemColor(item);
      statusBarItems[key].tooltip = getTooltipText(item);
    } else {
      statusBarItems[key] = createStatusBarItem(item);
    }
  });
}

function createStatusBarItem(item) {
  const barItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0 - stockCodes.indexOf(item.code));
  barItem.text = getItemText(item);
  barItem.color = getItemColor(item);
  barItem.tooltip = getTooltipText(item);
  barItem.show();
  return barItem;
}

function keepDecimal(num, fixed) {
  var result = parseFloat(num);
  if (isNaN(result)) {
    return "--";
  }
  return result.toFixed(fixed);
}

function calcFixedNumber(item) {
  var high = String(item.high).indexOf(".") === -1 ? 0 : String(item.high).length - String(item.high).indexOf(".") - 1;
  var low = String(item.low).indexOf(".") === -1 ? 0 : String(item.low).length - String(item.low).indexOf(".") - 1;
  var open = String(item.open).indexOf(".") === -1 ? 0 : String(item.open).length - String(item.open).indexOf(".") - 1;
  var yest = String(item.yestclose).indexOf(".") === -1 ? 0 : String(item.yestclose).length - String(item.yestclose).indexOf(".") - 1;
  var updown = String(item.updown).indexOf(".") === -1 ? 0 : String(item.updown).length - String(item.updown).indexOf(".") - 1;
  var max = Math.max(high, low, open, yest, updown);
  if (max === 0) {
    max = 2;
  }
  return max;
}
