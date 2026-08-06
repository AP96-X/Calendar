# -*- coding: utf-8 -*-
"""节假日查询服务（合并调用 + 内存缓存）"""

from functools import lru_cache
from datetime import date
from chinese_calendar import get_holiday_detail

HOLIDAY_CN_MAP = {
    'New Year\'s Day': '元旦', 'New Year\'s Day Holiday': '元旦假期',
    'Spring Festival': '春节', 'Spring Festival Holiday': '春节假期',
    'Tomb-sweeping Day': '清明节', 'Tomb-sweeping Day Holiday': '清明假期',
    'Labour Day': '劳动节', 'Labour Day Holiday': '劳动节假期',
    'Dragon Boat Festival': '端午节', 'Dragon Boat Festival Holiday': '端午假期',
    'Mid-autumn Festival': '中秋节', 'Mid-autumn Festival Holiday': '中秋假期',
    'National Day': '国庆节', 'National Day Holiday': '国庆假期',
}


@lru_cache(maxsize=400)
def get_holiday_info(g_date: date):
    """
    一次调用获取所有节假日信息（带 LRU 缓存）。
    返回: (holiday_name, is_holiday, is_workday, adjust_for)
    """
    try:
        is_hol, raw_name = get_holiday_detail(g_date)
        if is_hol:
            name = HOLIDAY_CN_MAP.get(raw_name, raw_name)
            return (name, True, False, '')
        if raw_name:
            adjust_name = HOLIDAY_CN_MAP.get(raw_name, raw_name)
            return ('', False, True, adjust_name)
        # 普通周末（chinese_calendar 不报告）
        return ('', False, g_date.weekday() < 5, '')
    except Exception:
        return ('', False, g_date.weekday() < 5, '')


# 保留旧接口兼容性
def get_holiday_name(g_date):
    return get_holiday_info(g_date)[0]


def check_holiday(g_date):
    return get_holiday_info(g_date)[1]


def check_workday(g_date):
    return get_holiday_info(g_date)[2]


def get_adjust_info(g_date):
    return get_holiday_info(g_date)[3]
