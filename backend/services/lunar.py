# -*- coding: utf-8 -*-
"""农历换算服务（带内存缓存）"""

from functools import lru_cache
from datetime import date, timedelta
from lunardate import LunarDate

LUNAR_MONTHS = ['', '正月', '二月', '三月', '四月', '五月', '六月',
                '七月', '八月', '九月', '十月', '冬月', '腊月']

_LUNAR_BASE = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
LUNAR_DAYS = ['']
for i in range(1, 11): LUNAR_DAYS.append('初' + _LUNAR_BASE[i])
for i in range(1, 10): LUNAR_DAYS.append('十' + _LUNAR_BASE[i])
LUNAR_DAYS.append('二十')
for i in range(1, 10): LUNAR_DAYS.append('廿' + _LUNAR_BASE[i])
LUNAR_DAYS.append('三十')


@lru_cache(maxsize=400)
def get_lunar_info(g_date: date) -> str:
    """获取农历信息（带 LRU 缓存，覆盖约一年日期）"""
    try:
        lunar = LunarDate.from_solar_date(g_date.year, g_date.month, g_date.day)
        month_name = LUNAR_MONTHS[lunar.month]
        if lunar.is_leap_month:
            month_name = '闰' + month_name
        day_name = LUNAR_DAYS[lunar.day]
        if lunar.day == 1 and lunar.month == 1:
            day_name = '春节'
        elif month_name == '腊月':
            if day_name == '三十':
                day_name = '除夕'
            elif lunar.day == 29:
                next_day_date = g_date + timedelta(days=1)
                try:
                    next_lunar = LunarDate.from_solar_date(
                        next_day_date.year, next_day_date.month, next_day_date.day)
                    if next_lunar.month == 1 and next_lunar.day == 1:
                        day_name = '除夕'
                except:
                    pass
        if day_name == month_name:
            return month_name
        if lunar.month == 1 and lunar.day == 1: return '春节'
        if lunar.month == 1 and lunar.day == 15: return '元宵节'
        if lunar.month == 5 and lunar.day == 5: return '端午节'
        if lunar.month == 7 and lunar.day == 7: return '七夕'
        if lunar.month == 7 and lunar.day == 15: return '中元节'
        if lunar.month == 8 and lunar.day == 15: return '中秋节'
        if lunar.month == 9 and lunar.day == 9: return '重阳节'
        if lunar.month == 12 and lunar.day == 8: return '腊八节'
        if lunar.day == 1: return month_name
        return day_name
    except Exception:
        return ''
