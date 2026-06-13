
import json, sys, os, time
os.environ['YF_CACHE'] = '1'
import yfinance as yf

symbols = ["000001.SS","399001.SZ","000300.SS","399006.SZ","000688.SS","^HSI","^GSPC","^IXIC","^DJI","^N225","CNY=X","GC=F","SI=F","CL=F","BTC-USD"]
result = {}
for sym in symbols:
    try:
        t = yf.Ticker(sym)
        info = t.info
        price = info.get("regularMarketPrice") or info.get("previousClose")
        prev = info.get("regularMarketPreviousClose") or info.get("previousClose")
        if price and prev:
            change = price - prev
            pct = (change / prev) * 100
            result[sym] = {"price": round(price, 4), "change": round(change, 4), "changePct": round(pct, 4), "trend": "up" if change >= 0 else "down"}
        else:
            result[sym] = None
    except:
        result[sym] = None
print(json.dumps({"status":"ok","data":result}))
  