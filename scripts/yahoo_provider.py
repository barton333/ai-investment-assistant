#!/usr/bin/env python3
"""
Yahoo Finance provider via Python yfinance.
Use Node.js child_process to call this script.
Returns JSON with all quotes.
"""
import json, sys, time

# Rate limiting: wait 3s between calls
last_call = 0

def main():
    global last_call
    symbols = [
        '000001.SS', '399001.SZ', '000300.SS', '399006.SZ', '000688.SS',
        '^HSI', '^GSPC', '^IXIC', '^DJI', '^N225',
        'CNY=X', 'GC=F', 'CL=F',
    ]
    result = {}
    
    for sym in symbols:
        elapsed = time.time() - last_call
        if elapsed < 2.5:
            time.sleep(2.5 - elapsed)
        
        try:
            import yfinance as yf
            ticker = yf.Ticker(sym)
            # Use fast_info which is lighter
            fast = ticker.fast_info
            price = None
            for attr in ['lastPrice', 'regularMarketPrice', 'previousClose']:
                try:
                    price = getattr(fast, attr, None)
                    if price: break
                except:
                    pass
            
            prev_close = None
            try:
                prev_close = fast.previous_close
            except:
                pass
            
            if price is None:
                # Try info as fallback
                info = ticker.info
                price = info.get('regularMarketPrice') or info.get('previousClose')
                prev_close = info.get('regularMarketPreviousClose') or info.get('previousClose')
            
            name_map = {
                '000001.SS': '上证指数', '399001.SZ': '深证成指',
                '000300.SS': '沪深300', '399006.SZ': '创业板指', '000688.SS': '科创50',
                '^HSI': '恒生指数', '^GSPC': '标普500',
                '^IXIC': '纳斯达克', '^DJI': '道琼斯', '^N225': '日经225',
                'CNY=X': '美元/人民币', 'GC=F': '黄金', 'CL=F': '原油',
            }
            
            if price and prev_close:
                change = price - prev_close
                pct = (change / prev_close) * 100 if prev_close else 0
                result[sym] = {
                    'name': name_map.get(sym, sym),
                    'price': round(price, 4),
                    'change': round(change, 4),
                    'changePct': round(pct, 4),
                    'trend': 'up' if change >= 0 else 'down',
                }
            else:
                result[sym] = {'error': f'No price data (price={price}, prev={prev_close})'}
        except Exception as e:
            result[sym] = {'error': str(e)[:100]}
        
        last_call = time.time()
    
    print(json.dumps({'status': 'ok', 'data': result}))

if __name__ == '__main__':
    main()
