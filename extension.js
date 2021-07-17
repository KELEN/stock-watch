const vscode = require("vscode");
const axios = require("axios");
const dayjs = require("dayjs");
const baseUrl = "https://api.money.126.net/data/feed/";
let statusBarItems = {};
let stockCodes = [];
let updateInterval = 10000;
let timer = null;
let showTimer = null;

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
    if (isNaN(code[0])) {
      if (code.toLowerCase().indexOf("us_") > -1) {
        return code.toUpperCase();
      } else if (code.indexOf("hk") > -1) {
        return code;
      } else {
        return code.toLowerCase().replace("sz", "1").replace("sh", "0");
      }
    } else {
      return(code[0] === "6" ? "0" : "1") + code;
    }
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
  return `「${
    item.name
  }」${
    keepDecimal(item.price, calcFixedNumber(item))
  } ${
    keepDecimal(item.percent * 100, 2)
  }%`;
}

function getTooltipText(item) {

  const config = vscode.workspace.getConfiguration();
  const stocks = config.get("stock-watch.stocks");

  const match = stocks.find(configItem => {
    const [code] = configItem.split('|');
    return code === item.symbol;
  })

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
    item.type
  }${
    item.symbol
  }\n${moneyInfo}涨跌：${
    item.updown
  }   百分：${
    keepDecimal(item.percent * 100, 2)
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

function fetchAllData() {
	console.log('featch data')
  if (isShowTime()) {
    axios.get(`${baseUrl}${
      stockCodes.join(",")
    }?callback=a`).then((rep) => {
      console.log(rep);
      try {
        const result = JSON.parse(rep.data.slice(2, -2));
        let data = [];
        Object.keys(result).map((item) => {
          if (! result[item].code) {
            result[item].code = item; // 兼容港股美股
          }data.push(result[item]);
        });
        displayData(data);
      } catch (error) {}
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
