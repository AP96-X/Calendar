# -*- coding: utf-8 -*-
"""二十四节气计算服务（带内存缓存 + 批量写入）"""

import ephem
from datetime import date, timedelta
from functools import lru_cache
from ..database import get_db

SOLAR_TERM_NAMES = ['春分', '清明', '谷雨', '立夏', '小满', '芒种',
                    '夏至', '小暑', '大暑', '立秋', '处暑', '白露',
                    '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
                    '冬至', '小寒', '大寒', '立春', '雨水', '惊蛰']


def compute_solar_terms_for_year(year):
    """计算并写入当年节气（仅 DB 未缓存时调用）"""
    db = get_db()
    sun = ephem.Sun()
    terms_all = {}
    prev_lon = None
    d = date(year, 1, 1)
    end = date(year + 1, 3, 1)

    while d <= end:
        sun.compute(str(d))
        lon = (float(sun.hlon) / 3.14159265 * 180) % 360
        if prev_lon is not None:
            for i in range(24):
                boundary = i * 15
                if (prev_lon < boundary and lon >= boundary) or \
                   (prev_lon > 345 and boundary == 0 and lon >= 0 and lon < 15):
                    idx = (i + 12) % 24
                    if idx not in terms_all:
                        terms_all[idx] = d
        prev_lon = lon
        d += timedelta(days=1)

    # 批量写入
    values = [(year, SOLAR_TERM_NAMES[k], v.strftime('%Y-%m-%d')) for k, v in terms_all.items()]
    db.executemany(
        'INSERT OR REPLACE INTO solar_terms (year, term_name, date) VALUES (?, ?, ?)',
        values)
    db.commit()
    return {SOLAR_TERM_NAMES[k]: v.strftime('%Y-%m-%d') for k, v in terms_all.items()}


@lru_cache(maxsize=5)
def get_solar_terms_for_year(year: int):
    """获取全年节气字典（LRU 缓存，覆盖 5 个年份）"""
    db = get_db()
    rows = db.execute('SELECT term_name, date FROM solar_terms WHERE year = ?', (year,)).fetchall()
    if len(rows) < 24:
        terms = compute_solar_terms_for_year(year)
        # 计算结果已写入 DB，清除可能过期的缓存让下次重新从 DB 读
        get_solar_terms_for_year.cache_clear()
        return terms
    return {r['term_name']: r['date'] for r in rows}


def get_solar_term_for_date(g_date: date):
    """获取指定日期的节气名称（利用缓存避免重复 DB 查询）"""
    terms = get_solar_terms_for_year(g_date.year)
    if g_date.month <= 2:
        terms_prev = get_solar_terms_for_year(g_date.year - 1)
        terms = {**terms_prev, **terms}
    date_str = g_date.strftime('%Y-%m-%d')
    for name, d_str in terms.items():
        if d_str == date_str:
            return name
    return ''
